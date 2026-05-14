import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
      "/approve": "http://localhost:3000",
    },
  },
  build: {
    outDir: resolve(__dirname, "public"),
    emptyOutDir: true,
  },
});
