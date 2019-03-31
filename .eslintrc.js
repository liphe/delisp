module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "prettier/@typescript-eslint"
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  plugins: ["import"],
  settings: {
    // In theory, we could remove all the import/* settings when there
    // is a new release of the eslint-plugin-import plugin.
    "import/extensions": [".js", ".ts"],
    "import/parsers": {
      "@typescript-eslint/parser": [".ts"]
    },
    "import/resolver": {
      node: {
        extensions: [".js", ".ts"]
      }
    }
  },
  rules: {
    "arrow-parens": ["error", "as-needed"],
    "comma-dangle": ["error", "never"],
    "sort-keys": "off",
    "quote-props": "off",
    "no-restricted-globals": ["error", "process"],
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/interface-name-prefix": ["error", "never"],
    "@typescript-eslint/explicit-member-accessibility": "off",
    "@typescript-eslint/member-ordering": "off",
    // Should be an error, but there is a problem with the rule.
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/array-type": ["error", "array-simple"],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "import/no-cycle": "error"
  }
};
