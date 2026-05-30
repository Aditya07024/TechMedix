import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "", "");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const backendTarget = env.VITE_API_URL || "http://localhost:8080";

  const backendProxy = {
    target: backendTarget,
    changeOrigin: true,
    ws: true,
  };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      include: ["axios"], // ensure axios is bundled
    },
    server: {
      proxy: {
        "/api": backendProxy,
        "/auth": backendProxy,
        "/uploads": backendProxy,
        "/queue": backendProxy,
        "/aipop": backendProxy,
        "/new": backendProxy,
        "/allmedicines": backendProxy,
        "/medicines": backendProxy,
        "/prescription": backendProxy,
        "/socket.io": backendProxy,
      },
    },
  };
});
