import { expect, test } from "@playwright/test";

test("M0 shell renders at the installed path with only shipped navigation", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic-test" }));
    localStorage.setItem("nethvoice.agents.language", "en");
  });
  const paths: string[] = [];
  await page.route("**/freepbx/rest/agents/**", async (route) => {
    paths.push(new URL(route.request().url()).pathname);
    expect(route.request().headers()["user"]).toBe("administrator");
    await route.fulfill({ json: { milestone: "M0", contract_version: 1, capabilities: [], csrf: "synthetic-csrf" } });
  });
  await page.goto("./#/agents");
  await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeVisible();
  await expect(page.getByText("Voice agents are coming")).toBeVisible();
  await expect(page.getByRole("link", { name: "Data sources" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New agent" })).toHaveCount(0);
  await page.goto("./#/workflows/new");
  await expect(page).toHaveURL(/#\/agents$/);
  await page.screenshot({ path: "/tmp/voice-agent-m0-ui.png", fullPage: true });
  expect(paths).toEqual(["/freepbx/rest/agents/access"]);
});

test("unsigned visitors use Wizard sign-in and send no API request", async ({ page }) => {
  let calls = 0;
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("nethvoice.agents.language", "en"); });
  await page.route("**/freepbx/rest/agents/**", () => { calls++; });
  await page.goto("./");
  await expect(page.getByText("Administrator login required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in through Wizard" })).toBeVisible();
  expect(calls).toBe(0);
});
