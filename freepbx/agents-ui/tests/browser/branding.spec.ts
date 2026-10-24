import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const wizardLogo = readFileSync(new URL("../../../wizard-ui/app/images/brandDark.svg", import.meta.url));
const customLogo = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect width="400" height="80" fill="#171717"/><text x="12" y="55" fill="white" font-size="40">Example Voice</text></svg>';

for (const branded of [false, true]) {
  for (const mobile of [false, true]) {
    test(`${branded ? "Wizard rebranding" : "Wizard default logo"} fits the ${mobile ? "mobile" : "desktop"} header`, async ({ page }) => {
      await page.setViewportSize({ width: mobile ? 375 : 1440, height: mobile ? 812 : 1024 });
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem("nethvoice.agents.language", "en");
      });
      let legacyScriptRequests = 0;
      await page.route("**/freepbx/wizard/scripts/custom.js", async route => {
        legacyScriptRequests++;
        await route.abort();
      });
      await page.route("**/freepbx/wizard/branding.json", async route => {
        expect(route.request().headers()).not.toHaveProperty("secretkey");
        await route.fulfill({ json: {
          BRAND_NAME: branded ? "Example Voice" : "NethVoice",
          NAVBAR_LOGO_URL: branded ? "images/example.svg" : "",
        } });
      });
      await page.route("**/freepbx/wizard/images/brandDark.svg", route => route.fulfill({ contentType: "image/svg+xml", body: wizardLogo }));
      await page.route("**/freepbx/wizard/images/example.svg", route => route.fulfill({ contentType: "image/svg+xml", body: customLogo }));
      await page.goto("./#/agents");
      const logo = page.getByRole("banner").getByRole("img", { name: branded ? "Example Voice" : "NethVoice", exact: true });
      await expect(logo).toHaveAttribute("src", new RegExp(branded ? "/freepbx/wizard/images/example.svg$" : "/freepbx/wizard/images/brandDark.svg$"));
      await expect(logo).toBeVisible();
      await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await page.getByRole("button", { name: "Light mode", exact: true }).click();
      await expect(logo).toBeVisible();
      const box = await logo.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(mobile ? 128 : 200);
      expect(box!.height).toBeLessThanOrEqual(28);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(legacyScriptRequests).toBe(0);
      await page.screenshot({ path: `/tmp/voice-agent-branding-${branded ? "custom" : "default"}-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    });
  }
}

test("branding unavailable uses the Wizard default without blocking sign-in", async ({ page }) => {
  await page.route("**/freepbx/wizard/branding.json", route => route.fulfill({ status: 503, body: "" }));
  await page.route("**/freepbx/wizard/images/brandDark.svg", route => route.fulfill({ contentType: "image/svg+xml", body: wizardLogo }));
  await page.goto("./");
  await expect(page.getByRole("banner").getByRole("img", { name: "NethVoice", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in through Wizard" })).toBeVisible();
});

test("an unavailable custom image falls back to the Wizard image", async ({ page }) => {
  await page.route("**/freepbx/wizard/branding.json", route => route.fulfill({ json: { BRAND_NAME: "Example Voice", NAVBAR_LOGO_URL: "images/missing.svg" } }));
  await page.route("**/freepbx/wizard/images/missing.svg", route => route.fulfill({ status: 404, body: "" }));
  await page.route("**/freepbx/wizard/images/brandDark.svg", route => route.fulfill({ contentType: "image/svg+xml", body: wizardLogo }));
  await page.goto("./");
  const logo = page.getByRole("banner").getByRole("img", { name: "Example Voice", exact: true });
  await expect(logo).toHaveAttribute("src", "/freepbx/wizard/images/brandDark.svg");
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});
