import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["**/node_modules/", "**/out/", "spikes/"] },
  js.configs.recommended,
  {
    rules: {
      "eqeqeq": "error",
      "no-empty": "error",
      "prefer-const": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "max-lines": ["warn", { max: 250, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["bridge/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // protocol.mjs is shared with the bridge, so it must not use Foundry or browser globals.
    files: ["module/scripts/protocol.mjs"],
    languageOptions: { globals: {} },
  },
  {
    files: ["module/**/*.mjs"],
    ignores: ["module/scripts/protocol.mjs"],
    languageOptions: {
      globals: { ...globals.browser, game: "readonly", canvas: "readonly", ui: "readonly", Hooks: "readonly",
        foundry: "readonly", CONFIG: "readonly", CONST: "readonly", PIXI: "readonly",
        Application: "readonly", FilePicker: "readonly", loadTexture: "readonly" },
    },
  },
];
