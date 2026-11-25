import { expect, test } from "@playwright/test";

for (const scheme of ["light", "dark"] as const) {
  test(`without a saved choice the theme follows the ${scheme} system preference`, async ({page}) => {
    await page.emulateMedia({colorScheme: scheme});
    await page.addInitScript(() => {
      localStorage.removeItem("nethvoice.agents.theme");
      localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
    });
    await page.route("**/freepbx/rest/agents/**", route => route.fulfill({json: route.request().url().endsWith("/access") ? {csrf: "synthetic-csrf"} : {items: []}}));
    await page.goto("./#/agents");
    if (scheme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
    else await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
}

test("a saved choice wins over the system preference", async ({page}) => {
  await page.emulateMedia({colorScheme: "dark"});
  await page.addInitScript(() => localStorage.setItem("nethvoice.agents.theme", "light"));
  await page.goto("./#/agents");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
