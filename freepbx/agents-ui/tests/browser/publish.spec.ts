import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = new URL("../../../var/www/html/freepbx/rest/lib/agents/contracts/", import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, base), "utf8"));
const capabilities = read("provider-models-v2.json");
const tools = read("tools-v5.json");
const models = {items: capabilities.openai.models, backend_models: capabilities.openai.backend_models, default_model: capabilities.openai.default, source: "provider_api", selection: "selectable"};
const trunk = {binding_id: "trunk_test", provider: "openai", name: "Shared OpenAI", revision: 1, sync_status: "synced", openai_project_id: "proj_test", api_key_configured: true, webhook_secret_configured: true};

function draft() {
  const value = read("published-v8.example.json");
  for (const key of ["agent_id", "destination_id", "workflow_version", "provider"]) delete value[key];
  value.provider_binding_id = null;
  return value;
}

test("a rejected first publication keeps the created agent and retries on it", async ({page}) => {
  page.on("pageerror", error => {throw error;});
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
    localStorage.setItem("nethvoice.agents.language", "en");
  });
  let record: Record<string, unknown> | null = null;
  let creates = 0, publishes = 0;
  await page.route("**/freepbx/rest/agents/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/freepbx/rest/agents", "");
    if (path === "/profiles" && request.method() === "POST") {
      creates++;
      const input = request.postDataJSON();
      record = {agent_id: "agent_new", name: input.profile.name, agent_type: "basic_voice", kind: "custom", enabled: false, routable: false, revision: 1, draft_version: 1, workflow_version: null, sync_status: "synced", published: null, draft: input.profile.draft};
      await route.fulfill({json: record});
      return;
    }
    if (path === "/profiles/agent_new/publish") {
      publishes++;
      expect(request.postDataJSON().expected_revision).toBe(1);
      if (publishes === 1) {
        await route.fulfill({status: 422, json: {error: "conversation_required"}});
        return;
      }
      record = {...record!, revision: 2, workflow_version: 1, enabled: true, routable: true, published: (record as {draft: unknown}).draft};
      await route.fulfill({json: record});
      return;
    }
    if (path === "/profiles/agent_new") {
      await route.fulfill({json: record});
      return;
    }
    if (path === "/trunks/models") {
      await route.fulfill({json: models});
      return;
    }
    await route.fulfill({json: path === "/access" ? {csrf: "synthetic-csrf"} : path === "/catalog" ? {tools, draft_defaults: draft(), extensions: [], default_language: "en", languages: [{id: "en", label: "English"}]} : path === "/trunks" ? {items: [trunk]} : path === "/destinations" ? {items: [], next_offset: null, modules: {}, unavailable_ids: []} : {items: record ? [record] : []}});
  });
  await page.goto("./#/agents/new");
  await page.getByLabel("Name", {exact: true}).fill("Night desk");
  await page.getByRole("combobox", {name: "Provider trunk", exact: true}).click();
  await page.getByRole("option", {name: /Shared OpenAI/}).click();
  await page.getByRole("button", {name: "Publish", exact: true}).click();
  await expect(page.getByText("Voice and instructions are required.")).toBeVisible();
  await expect(page.getByRole("textbox", {name: "Agent type"})).toHaveValue("Basic voice");
  expect(creates).toBe(1);
  await expect(page).toHaveURL(/#\/agents\/agent_new$/);
  await page.reload();
  await expect(page.getByLabel("Name", {exact: true})).toHaveValue("Night desk");
  await page.getByRole("button", {name: "Publish", exact: true}).click();
  await expect(page).toHaveURL(/#\/agents\/agent_new$/);
  await expect(page.getByText("Version 1 is published.")).toBeVisible();
  expect(creates).toBe(1);
  expect(publishes).toBe(2);
});

test("a create with an unknown result blocks another create", async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
    localStorage.setItem("nethvoice.agents.language", "en");
  });
  let creates = 0;
  await page.route("**/freepbx/rest/agents/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/freepbx/rest/agents", "");
    if (path === "/profiles" && request.method() === "POST") {
      creates++;
      await route.abort("connectionreset");
      return;
    }
    await route.fulfill({json: path === "/access" ? {csrf: "synthetic-csrf"} : path === "/catalog" ? {tools, draft_defaults: draft(), extensions: [], default_language: "en", languages: [{id: "en", label: "English"}]} : path === "/trunks" ? {items: [trunk]} : path === "/destinations" ? {items: [], next_offset: null, modules: {}, unavailable_ids: []} : {items: []}});
  });
  await page.goto("./#/agents/new");
  await page.getByLabel("Name", {exact: true}).fill("Night desk");
  await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect(page.getByText(/The connection ended before the result was received/)).toBeVisible();
  await expect(page.getByRole("button", {name: "Save draft", exact: true})).toBeDisabled();
  await expect(page.getByRole("button", {name: "Publish", exact: true})).toBeDisabled();
  await page.getByLabel("Name", {exact: true}).press("Enter");
  expect(creates).toBe(1);
});
