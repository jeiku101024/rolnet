import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "**/*.min.js",
  ]),
  // Feature 013: the service-role client is server-only and used by the purge route alone.
  {
    ignores: ["app/api/cron/**", "tests/**", "lib/supabase/service.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "@/lib/supabase/service", message: "The service-role client may only be imported by app/api/cron routes." }] }],
    },
  },
]);

export default eslintConfig;
