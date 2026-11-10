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
  // watched: on Windows a locked temp file kills the whole dev server. Probe
  // scripts are dot-prefixed (".probe-*.mjs", ".sys-probe.mjs") anywhere in the
  // repo, so match them by name rather than one directory.
  server: {
    host: true,
    watch: {
      ignored: [
        "**/.*probe*",
        "**/probe-*.mjs",
        "**/*.out",
        "**/admin-page-diff.json",
        "**/dashboard-diff*.json",
        "**/scripts/**",
      ],
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          setupFiles: "./src/test/setup.js",
          include: ["src/**/*.{test,spec}.{js,jsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.{test,spec}.js"],
        },
      },
    ],
  },
});
