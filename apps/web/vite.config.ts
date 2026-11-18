import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    // Same-origin API in development, like the Netlify proxy in production,
    // so the session cookie is first-party.
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://localhost:3001" },
  },
});
