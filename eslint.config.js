// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  { ignores: ["dist", "server"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "simple-import-sort": simpleImportSort,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Import sorting - groups: React, Fluent, 3rd party, our @/ aliases, relative, styles
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^react", "^react-dom"], // React first
            ["^@fluentui", "^@fluentui-copilot"], // Fluent UI packages
            ["^@?\\w"], // Other external packages (npm)
            ["^@/"], // Internal aliases (@/config, @/components, etc.)
            ["^\\.\\."], // Parent imports
            ["^\\."], // Sibling imports
            ["^.+\\.s?css$"], // Style imports
          ],
        },
      ],
      "simple-import-sort/exports": "error",
      // No barrel files
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message:
            "Barrel exports (export *) are not allowed. Import directly from the source file.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/index", "**/index.ts", "**/index.tsx"],
              message:
                "Do not import from barrel files. Import directly from the source file.",
            },
          ],
        },
      ],
      // Accessibility rules
      ...jsxA11y.configs.recommended.rules,
      // Require curly braces for all control statements
      curly: ["error", "all"],
    },
  },
]);
