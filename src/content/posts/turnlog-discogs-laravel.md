---
title: "Building a Discogs API layer in Laravel: how TurnLog talks to vinyl data"
description: "How I built the Discogs integration for TurnLog, a vinyl collection tracker, with a clean interface, caching decorator, exception hierarchy, and a fake client that makes testing painless."
pubDatetime: 2026-11-18
tags: [laravel, php, api, vinyl]
ogImage: /images/turnlog-discogs-cover.png
draft: false
---

TurnLog is a vinyl collection tracker. The whole point of it is that you scan or search for a record, it fetches the data from Discogs, and you log it to your collection. That means every core feature lives or dies on how well the Discogs integration holds up.

Discogs has a decent API. It has 60 million releases in its database. It also has rate limits, a quirky title format, pagination that bites you if you're not careful, and search results that return the same album fifteen times in different pressings. None of that is unfair; it's just what you're working with.

Here is what I built to handle it, and why.

## What the layer needs to do

The app needs three things from Discogs:

- **Search releases by text**: user types "Pink Floyd" or "Lateralus", gets back a list of records
- **Search by barcode**: user scans the barcode on the sleeve, gets the release
- **Fetch a full release by ID**: once you pick a release from search results, pull its tracklist, images, label, year

That's it. No write operations. No OAuth dance. Discogs lets you generate a personal access token and pass it in a header, so authentication is one environment variable and one line of code.

## Start with an interface

Before writing any HTTP code I defined a contract:

```php
interface DiscogsClient
{
    public function searchReleases(string $query, int $page = 1): array;
    public function searchByBarcode(string $barcode): array;
    public function getRelease(int $id): array;
}
```

Three methods. Returns arrays because Discogs JSON maps directly to PHP arrays and adding a full DTO layer for external data you don't fully control is more pain than it's worth at this stage.

The reason for the interface isn't abstraction for its own sake. It's because there will be three implementations: one that talks to Discogs, one that wraps it in a cache, and one you use in tests. The interface is the only thing the rest of the app sees.

## The HTTP client

`HttpDiscogsClient` is the real one. It wraps Laravel's HTTP facade, sets the token header, maps errors, and enforces the vinyl-only filters:

```php
final class HttpDiscogsClient implements DiscogsClient
{
    public function __construct(private readonly string $token) {}

    public function searchReleases(string $query, int $page = 1): array
    {
        return $this->buildClient()
            ->get('/database/search', [
                'q'      => $query,
                'type'   => 'release',
                'format' => 'Vinyl',
                'status' => 'Official',
                'page'   => $page,
            ])
            ->json();
    }
    
    // ...

    private function buildClient(): PendingRequest
    {
        return Http::baseUrl('https://api.discogs.com')
            ->withHeaders([
                'Authorization' => "Discogs token={$this->token}",
                'User-Agent'    => 'TurnLog/1.0 +https://github.com/guibrasil/turnlog-api',
            ])
            ->throw(function (Response $response) {
                throw match (true) {
                    $response->status() === 401 => new DiscogsAuthException(...),
                    $response->status() === 404 => new DiscogsNotFoundException(...),
                    $response->status() === 429 => new DiscogsRateLimitException(
                        retryAfter: (int) ($response->header('Retry-After') ?: 60)
                    ),
                    $response->serverError()   => new DiscogsServerException(...),
                    default                    => new DiscogsException(...),
                };
            });
    }
}
```

A few decisions worth noting.

**The vinyl filters are hardcoded.** `format: Vinyl` and `status: Official` are not configurable. TurnLog is a vinyl tracker: there is no use case where you want CD results or unofficial bootlegs showing up in search. Making it a config option would just be code that never gets changed.

**The User-Agent is set explicitly.** Discogs requires it. If you omit it, requests start failing. The docs mention this but not loudly enough.

**Error mapping happens in `throw()`.** Laravel's HTTP client lets you pass a callback to `throw()` that runs on any non-2xx response. This is the right place to map HTTP status codes to domain exceptions: the calling code never sees an `HttpClientException`, it sees a `DiscogsRateLimitException` with a `retryAfter()` method.

## Exception hierarchy

There are five exception classes, all extending a base `DiscogsException`:

| Exception | HTTP status | Meaning |
|---|---|---|
| `DiscogsAuthException` | 401 | Bad token |
| `DiscogsNotFoundException` | 404 | Release doesn't exist |
| `DiscogsRateLimitException` | 429 | Slow down |
| `DiscogsServerException` | 5xx | Their problem |
| `DiscogsException` | everything else | Catch-all |

The rate limit one carries a `retryAfter()` method because that's the useful piece of data:

```php
final class DiscogsRateLimitException extends DiscogsException
{
    public function __construct(
        string $message = '',
        private readonly int $retryAfter = 60,
    ) {
        parent::__construct($message);
    }

    public function retryAfter(): int
    {
        return $this->retryAfter;
    }
}
```

In `bootstrap/app.php`, the exceptions render themselves as proper HTTP responses:

```php
$exceptions->render(fn (DiscogsRateLimitException $e) =>
    response()->json(['message' => $e->getMessage()], 503)
        ->header('Retry-After', (string) $e->retryAfter())
);

$exceptions->render(fn (DiscogsNotFoundException $e) =>
    response()->json(['message' => $e->getMessage()], 404)
);

// base class registered last — catches anything that fell through
$exceptions->render(fn (DiscogsException $e) =>
    response()->json(['message' => $e->getMessage()], 502)
);
```

One gotcha here: **the base class must be registered last**. Laravel uses `instanceof`, so if `DiscogsException` is registered before `DiscogsRateLimitException`, the base class swallows everything. I found this out by watching 429s turn into 502s and wondering why my rate limit header was missing.

## Caching with a decorator

The app binds `DiscogsClient` to a singleton that wraps the HTTP client in a caching layer:

```php
// AppServiceProvider::register()
$this->app->singleton(
    DiscogsClient::class,
    fn () => new CachingDiscogsClient(
        new HttpDiscogsClient(token: config('services.discogs.token'))
    )
);
```

`CachingDiscogsClient` implements the same interface and delegates to the inner client on a cache miss:

```php
final class CachingDiscogsClient implements DiscogsClient
{
    public function __construct(private readonly DiscogsClient $inner) {}

    public function searchReleases(string $query, int $page = 1): array
    {
        return Cache::remember(
            "discogs:search:{$query}:{$page}",
            ttl: 3600,
            callback: fn () => $this->inner->searchReleases($query, $page)
        );
    }

    public function getRelease(int $id): array
    {
        return Cache::remember(
            "discogs:release:{$id}",
            ttl: 86400,
            callback: fn () => $this->inner->getRelease($id)
        );
    }
    
    // ...
}
```

TTLs by content type:

| Content | TTL | Reason |
|---|---|---|
| Search results | 1 hour | User refinements within a session reuse the cache |
| Barcode lookups | 1 hour | Same reasoning as search |
| Release details | 24 hours | Vinyl data doesn't change; aggressive caching is safe |

Discogs gives you 60 requests per minute. With these TTLs, a user searching, browsing, and importing a handful of records in a session will typically hit the API fewer than ten times. The rate limit is not a practical concern.

## The service layer

Controllers don't touch the Discogs client directly. `ReleaseService` mediates:

```php
final class ReleaseService
{
    public function __construct(
        private readonly DiscogsClient $discogs,
        private readonly ReleaseImporter $importer,
    ) {}

    public function search(string $query, int $page = 1): array
    {
        $results = $this->discogs->searchReleases($query, $page);
        return $this->deduplicateByMaster($results['results'] ?? []);
    }

    public function find(int $discogsId): Release
    {
        return Release::where('discogs_id', $discogsId)->first()
            ?? $this->importer->import($this->discogs->getRelease($discogsId));
    }
}
```

**Two things worth unpacking.**

### Master deduplication

A search for "Dark Side of the Moon" returns the original pressing, the 180g reissue, the EU repress, the Japan pressing, the MFSL, and twelve more. Each is a separate Discogs release with the same `master_id`. For a collection tracker, you want one result per album; the user picks the specific pressing later.

The deduplication keeps the first result per `master_id`, and always keeps results with no `master_id` (some releases aren't linked to a master):

```php
private function deduplicateByMaster(array $results): array
{
    $seen = [];
    return array_filter($results, function (array $result) use (&$seen) {
        $masterId = $result['master_id'] ?? null;
        if ($masterId === null) return true;
        if (isset($seen[$masterId])) return false;
        return $seen[$masterId] = true;
    });
}
```

### Two-phase lookup

`find()` checks the local database before hitting Discogs. If the release was imported before, it comes from the DB. The Discogs API is only called on the first request for any given release. After that, the 24-hour cache and local DB mean the external API is out of the picture entirely.

## Storing raw JSON

When a release is imported, the full Discogs JSON response goes into a `raw` column:

```php
// Migration
$table->json('raw');

// ReleaseImporter
Release::updateOrCreate(
    ['discogs_id' => $data['id']],
    [
        'title'    => $title,
        'artist'   => $artist,
        'year'     => $data['year'] ?? null,
        'cover_url' => $this->extractImage($data['images'] ?? []),
        'raw'       => $data,
    ]
);
```

The structured columns hold what the app displays. The `raw` column holds everything Discogs gave you. This costs a bit of storage and pays for itself constantly: extracting the tracklist, surfacing genres, adding new fields to the API response: it all works from the stored JSON without re-fetching. When Discogs changes something in their response format you can re-derive the structured columns from stored data instead of re-importing.

## Parsing "Artist - Album"

This one will catch you. The Discogs search response returns `title` as a combined string: `"Pink Floyd - The Dark Side of the Moon"`. The release detail endpoint separates them properly, but search results don't. The fix:

```php
private function splitTitle(string $title): array
{
    $parts = explode(' - ', $title, 2);
    return count($parts) === 2 ? [$parts[0], $parts[1]] : ['', $title];
}
```

The `limit: 2` on `explode` is load-bearing. "Miles Davis - Kind of Blue - Legacy Edition" should split into `["Miles Davis", "Kind of Blue - Legacy Edition"]`, not `["Miles Davis", "Kind of Blue", "Legacy Edition"]`.

## Testing with a fake client

The test suite swaps the real Discogs client for a fake:

```php
final class FakeDiscogsClient implements DiscogsClient
{
    private array $searchResults = [];
    private array $releases = [];
    private ?DiscogsException $nextException = null;

    public function fakeSearch(array $results): void
    {
        $this->searchResults = $results;
    }

    public function fakeRelease(int $id, array $data): void
    {
        $this->releases[$id] = $data;
    }

    public function failWith(DiscogsException $e): void
    {
        $this->nextException = $e;
    }

    public function searchReleases(string $query, int $page = 1): array
    {
        $this->maybeThrow();
        return ['results' => $this->searchResults, 'pagination' => []];
    }

    // ...
}
```

This isn't a mock; it's a full implementation that runs in the service container. Tests configure state, make HTTP requests through the actual routes, and assert on the JSON response. The entire stack runs (validation, service layer, response resources) without a single outbound request.

```php
it('returns 503 when Discogs rate-limits the request', function () {
    $fake = new FakeDiscogsClient;
    $fake->failWith(new DiscogsRateLimitException('Too many requests', retryAfter: 30));
    $this->app->instance(DiscogsClient::class, $fake);

    $response = $this->actingAs($this->user)
        ->getJson('/api/releases/search?q=radiohead');

    $response->assertStatus(503)
        ->assertHeader('Retry-After', '30');
});
```

## What I'd change

The passive rate-limit strategy (throw an exception, let the client retry) is fine at current scale. If TurnLog ever runs background imports for large collections it'll need a queue with exponential backoff: the exception already carries `retryAfter()` so the data is there, it just needs a worker that uses it.

The token auth is also fine right now. Discogs supports OAuth 1.0 for user-level access (reading private collections, writing ownership data). TurnLog stores its own collection records, so there's no need to touch a user's Discogs account. If that changes, the `DiscogsClient` interface stays the same; only `HttpDiscogsClient` grows.

The rest of the layer I'd build the same way again.
