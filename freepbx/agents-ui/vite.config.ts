import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/freepbx/agents-ui/",
  test: { environment: "jsdom", include: ["tests/*.test.ts"] },
  plugins: [vue(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    proxy: process.env.AGENTS_PBX_URL
      ? {
          "/freepbx/rest": {
            target: process.env.AGENTS_PBX_URL,
            changeOrigin: false,
          },
        }
      : undefined,
  },
});
