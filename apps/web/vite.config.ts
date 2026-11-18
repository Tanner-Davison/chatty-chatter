import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // The deep icon paths are CommonJS; under "type": "module" a default import
    // of them yields { default: Icon }. Point them at the package's ESM build.
    alias: [
      {
        find: /^@mui\/icons-material\/(?!esm\/)(\w+)$/,
        replacement: "@mui/icons-material/esm/$1",
      },
    ],
  },
  server: { port: 3000 },
});
