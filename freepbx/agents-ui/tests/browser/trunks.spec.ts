import { expect, test, type Page } from "@playwright/test";

const openai = { binding_id: "trunk_openai", provider: "openai", name: "OpenAI production", revision: 1, sync_status: "synced", api_key_configured: false, api_key_source: "environment", webhook_secret_configured: false, webhook_status: "not_configured" };
const sip = { ...openai, binding_id: "trunk_sip", name: "OpenAI SIP", openai_project_id: "proj_sip", api_key_source: "stored", webhook_status: "verified", webhook_secret_configured: true };
const grok = { ...openai, binding_id: "trunk_grok", name: "Grok direct", provider: "grok", api_key_source: "stored" };
const agents = [
  { agent_id: "receptionist", name: "Receptionist", draft: { provider_binding_id: "trunk_openai", conversation: { model: "gpt-live-1" } }, published: null },
  { agent_id: "sales", name: "Sales", draft: { provider_binding_id: "trunk_sip", conversation: { model: "gpt-realtime-2.1" } }, published: { provider_binding_id: "trunk_openai" } },
];

export async function mockTrunks(page: Page, options: { language?: string; lab: boolean; trunks: unknown[]; handle?: (path: string, body: any) => unknown }) {
  page.on("pageerror", error => { throw error; });
  await page.addInitScript(language => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic" }));
    localStorage.setItem("nethvoice.agents.language", language);
  }, options.language || "en");
  await page.route("**/freepbx/rest/agents/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/freepbx/rest/agents", "");
    if (route.request().method() !== "GET") {
      const result = await options.handle?.(path, route.request().postDataJSON());
      if (result && typeof result === "object" && "status" in result) await route.fulfill(result as { status: number; json: unknown });
      else await route.fulfill({ json: result ?? {} });
      return;
    }
    const json = path === "/access" ? { csrf: "synthetic-csrf" }
      : path === "/catalog" ? { sip_lab_enabled: options.lab, openai_webhook_url: "https://pbx.example.org/satellite-webhooks/openai", grok_webhook_url: "https://pbx.example.org/satellite-webhooks/grok", provider_credentials: { openai: { environment_available: true }, grok: { environment_available: false } } }
        : path === "/trunks" ? { items: options.trunks }
          : path === "/profiles" ? { items: agents } : {};
    await route.fulfill({ json });
  });
}

for (const scenario of [{ language: "en", width: 1440 }, { language: "it", width: 390 }]) {
  test(`trunk list without the SIP lab ${scenario.language} at ${scenario.width}px`, async ({ page }) => {
    const en = scenario.language === "en";
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await mockTrunks(page, { language: scenario.language, lab: false, trunks: [openai] });
    await page.goto("./#/trunks");
    await expect(page.getByText(en ? "Connections to OpenAI used by your agents." : "Connessioni a OpenAI usate dagli agenti.")).toBeVisible();
    await expect(page.getByText(/Grok|CleverAI/)).toHaveCount(0);
    const row = page.getByRole("row").filter({ hasText: "OpenAI production" });
    await expect(row).toContainText(en ? "API key from Integrations" : "Chiave API da Integrazioni");
    await expect(row).toContainText("2");
    await expect(page.getByText("Webhook", { exact: true })).toHaveCount(0);
    if (en) {
      const headers = page.locator("thead th");
      await expect(headers).toHaveText(["Name", "Voice provider", "Status", "Credentials", "Agents", "Actions"]);
      for (const header of await headers.all()) expect((await header.boundingBox())!.height).toBeLessThan(60);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/voice-agent-trunks-${scenario.language}.png`, fullPage: true });
  });
}

test("trunk list in the SIP lab shows the webhook column", async ({ page }) => {
  await mockTrunks(page, { lab: true, trunks: [openai, sip, grok] });
  await page.goto("./#/trunks");
  await expect(page.getByText("Connections to the AI providers your agents use: OpenAI, Grok and CleverAI.")).toBeVisible();
  const row = (name: string) => page.getByRole("row").filter({ hasText: name });
  await expect(page.locator("thead th")).toHaveText(["Name", "Voice provider", "Status", "Credentials", "Webhook", "Agents", "Actions"]);
  await expect(row("OpenAI production")).toContainText("Not required");
  await expect(row("OpenAI SIP")).toContainText("Verified");
  await expect(row("Grok direct")).toContainText("Manual setup");
  for (const header of await page.locator("thead th").all()) expect((await header.boundingBox())!.height).toBeLessThan(60);
});

test("deleting a trunk in use names its agents and is blocked", async ({ page }) => {
  let deleted = "";
  await mockTrunks(page, { lab: false, trunks: [openai, { ...openai, binding_id: "trunk_spare", name: "Spare" }], handle: path => { deleted = path; return {}; } });
  await page.goto("./#/trunks");
  await page.getByRole("row").filter({ hasText: "OpenAI production" }).getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByText("Trunk OpenAI production will be deleted.")).toBeVisible();
  await expect(page.getByTestId("trunk-in-use")).toContainText("Agents Receptionist, Sales use this trunk.");
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("row").filter({ hasText: "Spare" }).getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByTestId("trunk-in-use")).toHaveCount(0);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(() => deleted).toBe("/trunks/trunk_spare");
  await expect(page.getByText("Trunk Spare has been deleted")).toBeVisible();
});
