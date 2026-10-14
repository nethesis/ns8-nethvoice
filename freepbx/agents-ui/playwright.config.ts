import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "/tmp/nethvoice-agents-browser-results",
  use: {
    baseURL: "http://127.0.0.1:5187/freepbx/agents-ui/",
    viewport: { width: 1440, height: 1024 },
    browserName: "chromium",
    channel: "chrome",
    launchOptions: { args: ["--no-sandbox"] },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5187 --strictPort",
    url: "http://127.0.0.1:5187/freepbx/agents-ui/",
    reuseExistingServer: false,
  },
});
