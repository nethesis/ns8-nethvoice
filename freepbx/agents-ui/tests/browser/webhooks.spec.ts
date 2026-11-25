import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, language = "en", theme = "light") {
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic-test" }));
    localStorage.setItem("nethvoice.agents.language", language);
    localStorage.setItem("nethvoice.agents.theme", theme);
  }, { language, theme });
}
const initial = { binding_id: "trunk_openai", provider: "openai", name: "OpenAI SIP", openai_project_id: "proj_explicit", revision: 1, sync_status: "synced", api_key_configured: true, api_key_source: "stored", webhook_secret_configured: false, webhook_status: "not_configured" };

for (const theme of ["light", "dark"]) for (const width of [1440, 375]) {
  test(`explicit webhook setup, exclusions and keyboard in ${theme} at ${width}px`, async ({ page }) => {
    const language = width === 375 ? "it" : "en";
    await login(page, language, theme);
    await page.setViewportSize({ width, height: 1024 });
    let trunk = { ...initial }, calls = 0;
    const others = [
      { ...initial, binding_id: "trunk_grok", name: "Grok", provider: "grok" },
      { ...initial, binding_id: "trunk_clever", name: "CleverAI", provider: "cleverai" },
      { ...initial, binding_id: "trunk_live", name: "GPT-Live only" },
    ];
    await page.route("**/freepbx/rest/agents/**", async route => {
      const path = new URL(route.request().url()).pathname.replace("/freepbx/rest/agents", "");
      if (route.request().method() !== "GET") {
        expect(path).toBe("/trunks/trunk_openai/configure-webhook");
        expect(route.request().method()).toBe("POST");
        expect(route.request().headers()["x-agents-csrf"]).toBe("synthetic-csrf");
        expect(route.request().postDataJSON()).toEqual({ expected_revision: trunk.revision });
        calls++;
        trunk = { ...trunk, webhook_status: "configured", webhook_secret_configured: true, revision: trunk.revision + 1 };
        await route.fulfill({ json: trunk });
        return;
      }
      const json = path === "/access" ? { csrf: "synthetic-csrf" }
        : path === "/catalog" ? {sip_lab_enabled:true} : path === "/trunks" ? { items: [trunk, ...others] }
          : path === "/profiles" ? { items: [{ agent_id: "live", draft: { provider_binding_id: "trunk_live", conversation: { model: "gpt-live-1" } }, published: null }] }
            : {};
      await route.fulfill({ json });
    });
    await page.goto("./#/trunks");
    const configure = page.getByRole("button", { name: language === "en" ? "Configure webhook" : "Configura webhook", exact: true });
    await expect(configure).toHaveCount(1);
    expect(calls).toBe(0);
    await expect(page.getByText(language === "en" ? /NethVoice does not verify it/ : /NethVoice non lo verifica/)).toBeVisible();
    for (let step = 0; step < 50 && !(await configure.evaluate(el => el === document.activeElement)); step++) await page.keyboard.press("Tab");
    await expect(configure).toBeFocused();
    expect(await configure.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page.getByText(language === "en" ? "Configured automatically" : "Configurato automaticamente", { exact: true })).toBeVisible();
    expect(calls).toBe(1);
    const state = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }));
    expect(state).not.toMatch(/signing_secret|whsec_|synthetic-provider-key/);
    const bounds = await configure.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/voice-webhook-${theme}-${width}.png`, fullPage: true });
  });
}

test("OpenAI creation needs a key and project but no signing secret; manual input stays available", async ({ page }) => {
  await login(page);
  let saved = false, configured = false;
  await page.route("**/freepbx/rest/agents/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/freepbx/rest/agents", "");
    if (route.request().method() !== "GET") {
      expect(path).toBe("/trunks");
      const data = route.request().postDataJSON();
      expect(data.trunk.api_key).toBe("synthetic-provider-key");
      expect(data.trunk.openai_project_id).toBe("proj_explicit");
      expect(data.trunk.webhook_secret).toBe("");
      saved = true;
      await route.fulfill({ json: initial });return;
    }
    const json = path === "/access" ? { csrf: "synthetic-csrf" }
      : path === "/catalog" ? { sip_lab_enabled:true, openai_webhook_url: "https://configured.example/satellite-webhooks/openai", provider_credentials: { openai: { environment_available: false } } }
        : path === "/trunks" ? { items: saved ? [initial] : [] } : { items: [] };
    if (path.endsWith("configure-webhook")) configured = true;
    await route.fulfill({ json });
  });
  await page.goto("./#/trunks");
  await page.getByRole("button", { name: "Create trunk", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("OpenAI SIP");
  await page.getByLabel("OpenAI project ID", { exact: true }).fill("proj_explicit");
  await page.getByText("Dedicated key", { exact: true }).click();
  await page.getByLabel(/^Provider API key/).fill("synthetic-provider-key");
  await expect(page.getByLabel(/^Webhook signing secret/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Provider webhook endpoint" })).toHaveValue("https://configured.example/satellite-webhooks/openai");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("button", { name: "Configure webhook", exact: true })).toBeVisible();
  expect(saved).toBe(true);expect(configured).toBe(false);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel(/^Provider API key/)).toHaveValue("");
  await expect(page.getByLabel(/^Webhook signing secret/)).toHaveValue("");
});

for (const error of ["webhook_secret_recovery_required", "webhook_provider_unavailable", "webhook_persistence_failed"]) {
  test(`setup errors provide recovery instructions: ${error}`, async ({ page }) => {
    await login(page);
    await page.route("**/freepbx/rest/agents/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === "POST") {
        await route.fulfill({ status: error === "webhook_secret_recovery_required" ? 409 : 503, json: { error } });return;
      }
      await route.fulfill({ json: path.endsWith("/access") ? { csrf: "synthetic-csrf" } : path.endsWith("/catalog") ? {sip_lab_enabled:true} : { items: path.endsWith("/trunks") ? [initial] : [] } });
    });
    await page.goto("./#/trunks");
    const button = page.getByRole("button", { name: "Configure webhook", exact: true });
    await button.click();
    await expect(page.getByText("Cannot configure webhook", { exact: true })).toBeVisible();
    await expect(page.getByText(error === "webhook_secret_recovery_required" ? /explicitly rotate it in OpenAI/ : error === "webhook_persistence_failed" ? /Check the database and encryption key/ : /Retry Configure webhook to inspect existing endpoints/)).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page.getByText(error, { exact: true })).toHaveCount(0);
  });
}
