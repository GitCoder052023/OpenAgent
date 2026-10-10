import path from "path";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.OPENAGENT_BACKEND || "http://localhost:14000";

const proxyPaths = [
  "/api",
  "/swagger",
  "/storage",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 13001,
    proxy: Object.fromEntries(
      // /api also carries the speech-to-text websocket
      proxyPaths.map((p) => [p, {target: backend, changeOrigin: true, ws: p === "/api"}])
    ),
  },
  build: {
    outDir: "build-temp",
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
});
