import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "node22",
  platform: "node",
  // @chatty/shared ships TypeScript source, so it is bundled in; everything
  // else stays an ordinary runtime dependency.
  noExternal: ["@chatty/shared"],
  sourcemap: true,
  clean: true,
});
