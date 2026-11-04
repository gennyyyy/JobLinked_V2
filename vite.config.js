import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  // Scratch files written by local probe/comparison scripts must never be
  // watched: on Windows a locked temp file kills the whole dev server.
  server: {
    watch: {
      ignored: ["**/.sys-probe.mjs", "**/*.out", "**/admin-page-diff.json", "**/dashboard-diff*.json"],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: true,
    include: ["src/**/*.{test,spec}.{js,jsx}", "server/**/*.{test,spec}.js"],
  },
});
