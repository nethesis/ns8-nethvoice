import { expect, test, type Page } from "@playwright/test";

const openai = { binding_id: "trunk_openai", provider: "openai", name: "OpenAI production", revision: 1, sync_status: "synced", api_key_configured: false, api_key_source: "environment", webhook_secret_configured: false, webhook_status: "not_configured" };
const sip = { ...openai, binding_id: "trunk_sip", name: "OpenAI SIP", openai_project_id: "proj_sip", api_key_source: "stored", webhook_status: "verified", webhook_secret_configured: true };
const grok = { ...openai, binding_id: "trunk_grok", name: "Grok direct", provider: "grok", api_key_source: "stored" };
const agents = [
  { agent_id: "receptionist", name: "Receptionist", draft: { provider_binding_id: "trunk_openai", conversation: { model: "gpt-live-1" } }, published: null },
  { agent_id: "sales", name: "Sales", draft: { provider_binding_id: "trunk_sip", conversation: { model: "gpt-realtime-2.1" } }, published: { provider_binding_id: "trunk_openai" } },
];

export async function mockTrunks(page: Page, options: { language?: string; lab: boolean; trunks: unknown[]; environment?: boolean; handle?: (path: string, body: any) => unknown }) {
  page.on("pageerror", error => { throw error; });
  await page.addInitScript(language => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic" }));
    localStorage.setItem("preferredLanguage", JSON.stringify(language));
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
      : path === "/catalog" ? { sip_lab_enabled: options.lab, openai_webhook_url: "https://pbx.example.org/satellite-webhooks/openai", grok_webhook_url: "https://pbx.example.org/satellite-webhooks/grok", provider_credentials: { openai: { environment_available: options.environment ?? true }, grok: { environment_available: false } } }
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

test("without the SIP lab the drawer is an OpenAI key and sends no hidden field", async ({ page }) => {
  const posts: { path: string; body: any }[] = [];
  await mockTrunks(page, { lab: false, trunks: [{ ...openai, openai_project_id: "proj_kept" }], handle: (path, body) => {
    posts.push({ path, body });
    return path === "/trunks/models" ? { items: [{ id: "gpt-live-1" }], webhook_check: "signed_call_required" } : openai;
  } });
  await page.goto("./#/trunks");
  await page.getByRole("button", { name: "Create trunk" }).click();
  await expect(page.getByTestId("trunk-provider")).toContainText("OpenAI");
  await expect(page.getByRole("combobox", { name: "Voice provider" })).toHaveCount(0);
  await expect(page.getByLabel(/OpenAI project ID/)).toHaveCount(0);
  await expect(page.getByLabel(/Webhook signing secret/)).toHaveCount(0);
  await expect(page.getByText("Provider webhook endpoint")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "API key source" })).toBeVisible();
  await page.getByRole("button", { name: "Test credential" }).click();
  await expect(page.getByTestId("credential-test-result")).toContainText("Credential verified");
  await expect(page.getByTestId("credential-test-result")).not.toContainText("Webhook");
  expect(posts[0].body).toEqual({ provider: "openai", credential_mode: "inherit", test: true, api_key: "" });
  await page.getByLabel("Name", { exact: true }).fill("Live trunk");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Trunk Live trunk has been created")).toBeVisible();
  const created = posts.find(post => post.path === "/trunks")!.body.trunk;
  expect(created).not.toHaveProperty("openai_project_id");
  expect(created).not.toHaveProperty("webhook_secret");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Trunk OpenAI production has been updated")).toBeVisible();
  const updated = posts.find(post => post.path === "/trunks/trunk_openai")!.body.trunk;
  expect(updated).not.toHaveProperty("openai_project_id");
});

test("in the SIP lab the drawer has provider fields, the endpoint and the webhook check", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const tests: any[] = [];
  let reject = false;
  await mockTrunks(page, { lab: true, trunks: [sip], handle: (path, body) => {
    if (path !== "/trunks/models") return sip;
    tests.push(body);
    return reject ? { status: 422, json: { error: "provider_project_unverified", field: "openai_project_id", webhook_check: "not_configured" } }
      : { items: [{ id: "gpt-realtime-2.1" }], webhook_check: "signed_call_required" };
  } });
  await page.goto("./#/trunks");
  await page.getByRole("button", { name: "Create trunk" }).click();
  await page.getByRole("combobox", { name: "Voice provider" }).click();
  await expect(page.getByRole("option", { name: "Grok" })).toBeVisible();
  await expect(page.getByRole("option", { name: "CleverAI" })).toBeVisible();
  await page.getByRole("option", { name: "Grok" }).click();
  await expect(page.getByLabel("Grok Direct SIP number")).toBeVisible();
  await expect(page.getByRole("group", { name: "SIP authentication" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Provider webhook endpoint" })).toHaveValue("https://pbx.example.org/satellite-webhooks/grok");
  await expect(page.getByRole("button", { name: "Test credential" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Voice provider" })).toBeDisabled();
  await expect(page.getByLabel(/^OpenAI project ID/)).toHaveValue("proj_sip");
  await expect(page.getByRole("textbox", { name: "Provider webhook endpoint" })).toHaveValue("https://pbx.example.org/satellite-webhooks/openai");
  await page.getByRole("button", { name: "Copy endpoint" }).click();
  await expect(page.getByText("The webhook endpoint has been copied to the clipboard")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://pbx.example.org/satellite-webhooks/openai");
  await page.getByRole("button", { name: "Test credential" }).click();
  const result = page.getByTestId("credential-test-result");
  await expect(result).toContainText("Credential verified");
  await expect(result).toContainText("Webhook not verified yet: place a test call to verify the signing secret.");
  expect(tests[0]).toMatchObject({ provider: "openai", test: true, binding_id: "trunk_sip", openai_project_id: "proj_sip" });
  expect(tests[0]).not.toHaveProperty("webhook_secret");
  reject = true;
  await page.getByLabel(/^OpenAI project ID/).fill("proj_other");
  await expect(result).toBeEmpty();
  await page.getByRole("button", { name: "Test credential" }).click();
  await expect(result).toContainText("Credential not verified");
  await expect(result).toContainText("The API key cannot access this OpenAI project.");
  await expect(result).toContainText("Webhook not configured");
  await expect(page.getByText("The API key cannot access this OpenAI project. Check the project ID.")).toHaveCount(2);
});

for (const language of ["en", "it"]) {
  test(`the integrations key says where it is set and whether it is set (${language})`, async ({ page }) => {
    const en = language === "en";
    const posted: unknown[] = [];
    await mockTrunks(page, { language, lab: false, trunks: [], environment: false, handle: (_path, body) => { posted.push(body); return {}; } });
    await page.goto("./#/trunks");
    await page.getByRole("button", { name: en ? "Create trunk" : "Crea trunk" }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("radio", { name: en ? "NethVoice integrations key" : "Chiave delle integrazioni NethVoice" })).toBeChecked();
    await expect(drawer).toContainText(en
      ? "It is in the NethServer 8 cluster admin: open the NethVoice application, then Integrations, OpenAI API Key."
      : "Si trova nell'amministrazione del cluster NethServer 8: apri l'applicazione NethVoice, poi Integrazioni, API Key OpenAI.");
    // The state of the key is part of its option, before how to set it.
    await expect(drawer.getByRole("radio", { name: en ? "NethVoice integrations key" : "Chiave delle integrazioni NethVoice" })).toHaveAccessibleName(en
      ? /^NethVoice integrations key\s*Not set yet\. It is in/
      : /^Chiave delle integrazioni NethVoice\s*Non ancora impostata\. Si trova/);
    await drawer.getByLabel(en ? "Name" : "Nome", { exact: true }).fill("OpenAI production");
    await drawer.getByRole("button", { name: en ? "Create" : "Crea", exact: true }).click();
    await expect(drawer.getByRole("alert")).toHaveText(en
      ? "Set the OpenAI API Key in Integrations, or use a dedicated key"
      : "Imposta la API Key OpenAI in Integrazioni o usa una chiave dedicata");
    expect(posted).toEqual([]);
    await drawer.getByRole("radio", { name: en ? "Dedicated key" : /dedicata/ }).check();
    await expect(drawer.getByLabel(en ? "Provider API key" : "Chiave API del provider")).toBeVisible();
  });
}
test("an available integrations key shows as set", async ({ page }) => {
  await mockTrunks(page, { lab: false, trunks: [] });
  await page.goto("./#/trunks");
  await page.getByRole("button", { name: "Create trunk" }).first().click();
  await expect(page.getByRole("dialog").getByRole("radio", { name: "NethVoice integrations key" })).toHaveAccessibleName(/^NethVoice integrations key\s*Already set\. It is in/);
});
test("an expired session keeps the trunk drawer and saves after sign-in", async ({ page }) => {
  const posted: { name: string; api_key: string }[] = [];
  let rejected = false;
  await mockTrunks(page, {
    lab: false,
    trunks: [],
    handle: (path, body) => {
      if (path !== "/trunks") return {};
      if (!rejected) {
        rejected = true;
        return { status: 401, json: { error: "unauthorized" } };
      }
      posted.push(body.trunk);
      return { ...body.trunk, binding_id: "kept", revision: 1 };
    },
  });
  await page.goto("./#/trunks");
  await page.getByRole("button", { name: "Create trunk" }).first().click();
  const drawer = page.getByRole("dialog").filter({ hasText: "Create trunk" });
  await drawer.getByLabel("Name", { exact: true }).fill("Kept trunk");
  await drawer.getByRole("radio", { name: "Dedicated key" }).check();
  await drawer.getByLabel("Provider API key").fill("sk-synthetic");
  await drawer.getByRole("button", { name: "Create", exact: true }).click();
  // The drawer and its input stay behind the Session expired dialog.
  const expired = page.getByRole("dialog").filter({ hasText: "Session expired" });
  await expect(expired.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByText("Administrator login required")).toHaveCount(0);
  await expect(drawer.getByLabel("Name", { exact: true })).toHaveValue("Kept trunk");
  expect(posted).toEqual([]);
  await page.evaluate(() => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "renewed" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "secretkey" }));
  });
  // The interrupted save runs again by itself, with the same input.
  await expect.poll(() => posted.map((trunk) => [trunk.name, trunk.api_key])).toEqual([["Kept trunk", "sk-synthetic"]]);
  await expect(drawer).toBeHidden();
  await expect(page.getByText("Trunk Kept trunk has been created")).toBeVisible();
});
