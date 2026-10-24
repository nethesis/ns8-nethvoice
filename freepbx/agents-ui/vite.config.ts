import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

export default defineConfig({
  base: "/freepbx/agents-ui/",
  test: { environment: "jsdom", include: ["tests/*.test.ts"] },
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: "wizard-branding-development",
      configureServer(server) {
        if (process.env.AGENTS_PBX_URL) return;
        server.middlewares.use((request, response, next) => {
          const path = request.url?.split("?")[0];
          if (path === "/freepbx/wizard/branding.json") {
            response.setHeader("Content-Type", "application/json");
            response.end(
              JSON.stringify({ BRAND_NAME: "NethVoice", NAVBAR_LOGO_URL: "" }),
            );
          } else if (path === "/freepbx/wizard/images/brandDark.svg") {
            response.setHeader("Content-Type", "image/svg+xml");
            response.end(
              readFileSync(
                new URL(
                  "../wizard-ui/app/images/brandDark.svg",
                  import.meta.url,
                ),
              ),
            );
          } else next();
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    proxy: process.env.AGENTS_PBX_URL
      ? {
          "/freepbx/rest": {
            target: process.env.AGENTS_PBX_URL,
            changeOrigin: false,
          },
          "/freepbx/wizard": {
            target: process.env.AGENTS_PBX_URL,
            changeOrigin: false,
          },
        }
      : undefined,
  },
});
