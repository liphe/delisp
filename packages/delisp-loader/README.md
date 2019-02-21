# Delisp Loader

This package transpiles your Delisp modules to JavaScript using webpack.

## Usage

Add the delisp-loader to your webpack configuration:

```js
module: {
  rules: [
    {
      test: /\.dl$/,
      exclude: /(node_modules)/,
      use: "delisp-loader"
    }
  ];
}
```
