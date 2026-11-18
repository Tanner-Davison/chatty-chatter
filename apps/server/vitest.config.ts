import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["test/setup.ts"],
    // Starting an in-memory mongod can take a while on first download.
    hookTimeout: 120_000,
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
