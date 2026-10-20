import { expect, test } from "@playwright/test";

for (const layout of [
  { name: "desktop", width: 1440, height: 1024, language: "en", title: "Saved successfully", retry: "Retry synchronization" },
  { name: "mobile", width: 375, height: 812, language: "it", title: "Salvataggio completato", retry: "Riprova sincronizzazione" },
]) {
  test(`notifications have readable width and stay inside the ${layout.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.addInitScript(({ language }) => {
      localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic-test" }));
      localStorage.setItem("nethvoice.agents.language", language);
    }, layout);
    await page.route("**/freepbx/rest/agents/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const json = path.endsWith("/access") ? { csrf: "synthetic-csrf" }
        : path.endsWith("/trunks") ? { items: [{ binding_id: "trunk_test", name: "Test provider", provider: "openai", revision: 1, sync_status: "pending" }] }
          : {};
      await route.fulfill({ json });
    });
    await page.goto("./#/trunks");
    const retry = page.getByRole("button", { name: layout.retry, exact: true });
    await retry.click();
    const headings = page.getByRole("heading", { name: layout.title, exact: true });
    await expect(headings).toHaveCount(1);
    const card = headings.first().locator("../../..");
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(Math.min(448, layout.width - 32));
    expect(box!.x).toBeGreaterThanOrEqual(16);
    expect(box!.x + box!.width).toBeLessThanOrEqual(layout.width - 16);
    expect(await headings.first().evaluate(heading => {
      const range = document.createRange();
      range.selectNodeContents(heading);
      const text = range.getBoundingClientRect();
      const bounds = heading.getBoundingClientRect();
      return text.left >= bounds.left && text.right <= bounds.right + 1;
    })).toBe(true);
    await retry.click();
    await expect(headings).toHaveCount(2);
    const second = await headings.nth(1).locator("../../..").boundingBox();
    const first = await card.boundingBox();
    expect(first!.y + first!.height).toBeLessThan(second!.y);
    await page.screenshot({ path: `/tmp/voice-agent-notifications-${layout.name}.png`, fullPage: true });
  });
}
