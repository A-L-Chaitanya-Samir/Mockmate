import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "backend/.venv/**",
    ".test-deps/**",
    "public/mediapipe/runtime/**",
    "docs/build-project-reference.cjs",
  ]),
]);
