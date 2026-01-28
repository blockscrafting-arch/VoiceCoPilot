import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const devPort = Number(process.env.PORT) || 1420;
const previewPort = Number(process.env.PORT) || 4173;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri expects a fixed port
  server: {
    host: true,
    port: devPort,
    strictPort: true,
  },
  preview: {
    host: true,
    port: previewPort,
    strictPort: true,
  },
  // Build settings for Tauri
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
