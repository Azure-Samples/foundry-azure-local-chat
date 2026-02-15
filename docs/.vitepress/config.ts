import { defineConfig } from "vitepress";
import { generateSidebar } from "vitepress-sidebar";

export default defineConfig({
  title: "Edge Core Chat",
  description: "Documentation for Edge Core Chat",
  srcDir: "src",
  outDir: "./dist",
  base: process.env.VITE_BASE_PATH || "/",
  cleanUrls: true,
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/1-getting-started/getting-started" },
    ],
    sidebar: generateSidebar({
      documentRootPath: "src",
      useTitleFromFileHeading: true,
      useFolderTitleFromIndexFile: true,
      useFolderLinkFromIndexFile: false,
      hyphenToSpace: true,
      underscoreToSpace: true,
      capitalizeFirst: true,
      collapsed: false,
      collapseDepth: 2,
      sortMenusByFrontmatterOrder: true,
      sortMenusOrderByDescending: false,
      excludeFilesByFrontmatterFieldName: "exclude",
      includeFolderIndexFile: false,
    }),
    socialLinks: [
      { icon: "github", link: "https://github.com/microsoft/Edge-Core-Chat" },
    ],
    search: {
      provider: "local",
    },
  },
});
