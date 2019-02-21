const {
  readModule,
  inferModule,
  compileModuleToString
} = require("@delisp/core");

const transpile = src => {
  const module = readModule(src);
  inferModule(module);
  return compileModuleToString(module);
};

module.exports = transpile;
