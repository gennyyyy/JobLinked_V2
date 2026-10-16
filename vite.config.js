import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: true,
    // Scope the runner to this app's own code — the globals are jsdom here but
    // the server suite runs node, and a stray nested project must never pad or
    // break the main suite.
    include: ["src/**/*.{test,spec}.{js,jsx}", "server/**/*.{test,spec}.js"],
  },
});
