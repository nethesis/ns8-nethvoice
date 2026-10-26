import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "secretkey",
      JSON.stringify({ user: "administrator", hash: "synthetic-test" }),
    );
    localStorage.setItem("nethvoice.agents.language", "en");
  });
}
const externalTrunk = {
  binding_id: "trunk_clever",
  name: "CleverAI transport",
  provider: "cleverai",
  openai_project_id: "proj_external",
  revision: 1,
  sync_status: "synced",
};
const localTrunk = {
  ...externalTrunk,
  binding_id: "trunk_local",
  name: "Local OpenAI",
  provider: "openai",
};
test("CleverAI trunk accepts only name and project, without local secrets or discovery", async ({
  page,
}) => {
  await login(page);
  let saved = false;
  await page.route("**/freepbx/rest/agents/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/freepbx/rest/agents",
      "",
    );
    expect(path).not.toMatch(/models|voices/);
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        trunk: {
          name: externalTrunk.name,
          provider: "cleverai",
          openai_project_id: "proj_external",
        },
        expected_revision: 0,
      });
      saved = true;
    }
    await route.fulfill({
      json:
        path === "/access"
          ? { csrf: "synthetic-csrf" }
          : path === "/catalog"
            ? {}
            : { items: saved ? [externalTrunk] : [] },
    });
  });
  await page.goto("./#/trunks");
  await page.getByRole("button", { name: "New trunk", exact: true }).click();
  await page.getByRole("button", { name: /^Voice provider/ }).click();
  await page.getByRole("option", { name: "CleverAI", exact: true }).click();
  for (const label of [
    "Provider API key",
    "Webhook signing secret",
    "Webhook endpoint",
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  await expect(
    page.getByText(/Configure the OpenAI incoming-call webhook externally/),
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(externalTrunk.name);
  await page
    .getByLabel("OpenAI project ID", { exact: true })
    .fill("proj_external");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: externalTrunk.name, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByLabel("OpenAI project ID", { exact: true }),
  ).toHaveValue("proj_external");
  await expect(
    page.getByLabel("Provider API key", { exact: true }),
  ).toHaveCount(0);
});

test("CleverAI creates and edits through Save, filters trunks and exposes no local conversation or activity", async ({
  page,
}) => {
  await login(page);
  let profile = null;
  const mutations: string[] = [];
  await page.route("**/freepbx/rest/agents/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/freepbx/rest/agents",
      "",
    );
    expect(path).not.toMatch(/publish|runs|models|voices/);
    if (route.request().method() !== "GET") {
      mutations.push(path);
      const input = route.request().postDataJSON();
      if (route.request().method() !== "DELETE") {
        expect(input.profile.draft).toEqual({
          execution: "cleverai",
          provider_binding_id: "trunk_clever",
          fallback_destination_id: "hangup",
        });
        expect(input.expected_revision).toBe(profile ? 1 : 0);
        profile = {
          ...input.profile,
          agent_id: "agent_external",
          agent_type: "cleverai",
          kind: "custom",
          destination_id: "agent:agent_external",
          revision: profile ? 2 : 1,
          enabled: true,
          routable: true,
          sync_status: "synced",
          published: null,
          workflow_version: null,
          draft_version: null,
        };
      }
      await route.fulfill({ json: profile });
      return;
    }
    await route.fulfill({
      json:
        path === "/access"
          ? { csrf: "synthetic-csrf" }
          : path === "/catalog"
            ? {
                default_language: "en",
                languages: [],
                tools: [],
                extensions: [],
              }
            : path === "/trunks"
              ? { items: [externalTrunk, localTrunk] }
              : path === "/profiles"
                ? { items: profile ? [profile] : [] }
                : profile,
    });
  });
  await page.goto("./#/agents/new");
  await page.getByRole("button", { name: /^Agent type/ }).click();
  await page.getByRole("option", { name: "CleverAI", exact: true }).click();
  for (const label of [
    "Conversation instructions",
    "Greeting",
    "Default language",
    "Call transcription",
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Tools", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Provider trunk/ }).click();
  await expect(page.getByRole("option", { name: /Local OpenAI/ })).toHaveCount(
    0,
  );
  await page.getByRole("option", { name: /CleverAI transport/ }).click();
  await page.getByLabel("Name", { exact: true }).fill("External agent");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents\/agent_external$/);
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Activity", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Published version:", { exact: false }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "External agent",
  );
  await page.getByLabel("Name", { exact: true }).fill("Renamed external agent");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents$/);
  expect(mutations).toEqual([
    "/profiles",
    "/profiles/agent_external",
    "/profiles/agent_external",
  ]);
});
