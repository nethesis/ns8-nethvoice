import { expect, test } from "@playwright/test";

for (const language of ["en", "it"]) {
  test(`topbar keeps the Wizard and help links next to the account menu (${language})`, async ({ page }) => {
    await page.addInitScript(language => {
      localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic" }));
      localStorage.setItem("nethvoice.agents.language", language);
      localStorage.setItem("nethvoice.agents.theme", "light");
    }, language);
    await page.route("**/freepbx/rest/agents/**", async route => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({ json: path.endsWith("/access") ? { csrf: "synthetic-csrf" } : { items: [] } });
    });
    await page.goto("./#/trunks");
    const en = language === "en";
    await expect(page.locator("#main-sidebar a")).toHaveText(en ? ["Agents", "Monitoring", "Provider trunks"] : ["Agenti", "Monitoraggio", "Trunk dei provider"]);
    await expect(page.getByTestId("wizard-link")).toHaveAttribute("href", "/freepbx/wizard/");
    await expect(page.getByTestId("wizard-link")).toHaveText("Wizard");
    await expect(page.getByTestId("documentation-link")).toHaveAttribute("target", "_blank");
    await page.getByRole("button", { name: en ? "Open account menu" : "Apri menu account" }).click();
    await expect(page.getByText("administrator", { exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: en ? "Switch to dark theme" : /scuro/ }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
}
