module.exports = {
  plugins: ["react"],
  extends: ["plugin:react/recommended"],
  settings: {
    react: {
      version: "detect"
    }
  },
  rules: {
    "react/prop-types": "off"
  }
};
