import nextVitals from "eslint-config-next/core-web-vitals";
import { globalIgnores } from "eslint/config";

const eslintConfig = [
  ...nextVitals,
  globalIgnores([".next/**", "out/**", "node_modules/**", "android/app/src/main/assets/public/**", "ios/App/App/public/**"]),
];

export default eslintConfig;
