// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { defineConfig } from "vitepress";
import { generateSidebar } from "vitepress-sidebar";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(defineConfig({
  title: "Edge Core Chat",
  description: "Documentation for Edge Core Chat",
  srcDir: "src",
  outDir: "./dist",
  base: "/",
  cleanUrls: true,
  ignoreDeadLinks: true,
  vue: {
    template: {
      compilerOptions: {
        whitespace: 'preserve'
      }
    }
  },
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
    socialLinks: [{ icon: "github", link: "https://github.com/microsoft/Edge-Core-Chat" }],
    search: {
      provider: "local",
    },
  },
}));
