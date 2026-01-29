import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const devPort = Number(process.env.PORT) || 1420;
const previewPort = Number(process.env.PORT) || 4173;

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (process.env.NODE_ENV !== "production") {
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/4d99c64e-0f7e-4f36-90da-c936a6efefa5", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "apps/web/vite.config.ts",
        message: "Vite config invoked",
        data: { command, mode, envPort: process.env.PORT || null },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "railway-start",
        hypothesisId: "H2",
      }),
    }).catch(() => {});
    // #endregion
    fetch("http://127.0.0.1:7247/ingest/4d99c64e-0f7e-4f36-90da-c936a6efefa5", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "apps/web/vite.config.ts",
        message: "Vite ports resolved",
        data: { devPort, previewPort, host: true },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "railway-start",
        hypothesisId: "H2",
      }),
    }).catch(() => {});
    // #endregion
  }

  return {
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
  };
});
