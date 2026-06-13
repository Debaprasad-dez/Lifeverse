import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // react-three-fiber JSX uses three.js props (args, position, intensity…)
      "react/no-unknown-property": "off",
      // R3F's core idiom mutates three.js objects/refs inside useFrame —
      // per-frame React state is forbidden here (see CLAUDE.md). The React
      // Compiler immutability lint cannot model that and must stay off.
      "react-hooks/immutability": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // standalone Vercel proxy — deployed separately, not part of the app
    "proxy/**",
  ]),
]);

export default eslintConfig;
