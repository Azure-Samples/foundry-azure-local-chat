// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import DefaultTheme from 'vitepress/theme'
import { LiteTree } from 'vitepress-plugin-tree'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LiteTree', LiteTree)
  }
}
