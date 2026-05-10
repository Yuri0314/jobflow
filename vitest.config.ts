import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@jobflow/protocol": resolve(rootDir, "packages/protocol/src/index.ts"),
      "@jobflow/runtime": resolve(rootDir, "packages/runtime/src/index.ts"),
      "@jobflow/schema": resolve(rootDir, "packages/schema/src/index.ts")
    }
  },
  test: {
    include: ["apps/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
    environment: "node"
  }
});
