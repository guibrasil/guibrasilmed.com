import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://guibrasilmed.com/",
    title: "Gui Medeiros",
    description:
      "I solve problems with code — then automate them so they stay solved.",
    author: "Guilherme Medeiros",
    profile: "https://github.com/guibrasil",
    lang: "en",
    timezone: "Europe/London",
  },
  posts: {
    perPage: 10,
    perIndex: 5,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: false,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
    toc: true,
  },
  socials: [
    { name: "github", url: "https://github.com/guibrasil" },
    { name: "linkedin", url: "https://linkedin.com/in/guibrasilmed" },
    { name: "mail", url: "mailto:guibrasilmed@gmail.com" },
  ],
  shareLinks: [
    {
      name: "linkedin",
      url: "https://www.linkedin.com/sharing/share-offsite/?url=",
    },
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
