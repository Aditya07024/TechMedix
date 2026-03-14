import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "", "");

  return {
    plugins: [react()],
    optimizeDeps: {
      include: ["axios"], // ensure axios is bundled
    },
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:8080",
          changeOrigin: true,
        },
      },
    },
  };
});
