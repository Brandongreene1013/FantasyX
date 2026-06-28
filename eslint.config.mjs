import { FlatCompat } from "@eslint/eslintrc";
import nextVitals from "eslint-config-next/core-web-vitals.js";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "build/**", "*.config.js"]
  },
  ...compat.config(nextVitals)
];

export default eslintConfig;
