module.exports = {
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  collectCoverageFrom: ["src/**/*.ts"],
  verbose: true,
  testPathIgnorePatterns: ["fixtures", "dist", "dist-test"],
  globals: {
    "ts-jest": {
      tsConfig: "tsconfig.json"
    }
  }
};
