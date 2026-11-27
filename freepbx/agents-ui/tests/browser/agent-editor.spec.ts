import { expect, test, type Page } from "@playwright/test";
import { choose, emptyDraft, flip, mockApi, profile, toggle } from "./agentsMock";

function ready(values: Record<string, unknown> = {}) {
  const draft = emptyDraft();
  draft.provider_binding_id = "trunk_openai";
  draft.conversation = { ...draft.conversation, model: "gpt-live-1", voice: "coral", instructions: "Greet the caller.", greeting: "Hello", options: { backend_model: "gpt-6-luna", backend_instructions: "Use the tools.", reasoning_effort: "medium", verbosity: "low", service_tier: "default", max_output_tokens: 2048 } };
  return profile({ draft, ...values });
}
const footer = (page: Page) => page.getByTestId("agent-footer");
const unsaved = (page: Page) => page.getByRole("dialog").filter({ hasText: "Unsaved changes" });

test("agent page: sections, collapsed troubleshooting, versions and readable GPT-Live settings", async ({ page }) => {
  await mockApi(page, { profiles: { receptionist: ready({ workflow_version: 2, draft_version: 2, enabled: true, routable: true, published: { ...ready().draft, workflow_version: 2 } }) } });
  await page.goto("./#/agents/receptionist");
  await expect(page.getByRole("heading", { name: "Receptionist" })).toBeVisible();
  await expect(page.getByText("Version 2 is published.", { exact: true })).toBeVisible();
  await expect(page.locator("main").getByText("Built-in", { exact: true })).toBeVisible();
  await expect(footer(page)).toHaveText("Published version 2");
  for (const name of ["General", "Conversation", "Tools"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test call" })).toHaveCount(0);
  await expect(toggle(page, "Call transcription")).toBeHidden();
  await page.getByRole("button", { name: "Troubleshooting" }).click();
  await expect(toggle(page, "Call transcription")).not.toBeChecked();
  await page.getByRole("button", { name: /^Advanced settings of / }).click();
  await expect(page.getByRole("combobox", { name: "Text model", exact: true })).toHaveValue(/GPT-6 Luna/);
  for (const label of ["Maximum answer length", "Text model instructions"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  await expect(page.getByText("Reasoning effort", { exact: true })).toBeVisible();
  await expect(page.getByText("Service tier", { exact: true })).toBeVisible();
  await page.getByLabel("Greeting").fill("Good morning");
  await expect(footer(page)).toHaveText("Unsaved changes");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("SIP lab off: no SIP Realtime model is offered and a saved one asks for GPT-Live", async ({ page }) => {
  const record = ready();
  record.draft.conversation = { ...record.draft.conversation, model: "gpt-realtime-2.1", options: null };
  await mockApi(page, { profiles: { receptionist: record } });
  await page.goto("./#/agents/receptionist");
  await expect(page.getByText(/The saved model is an experimental SIP Realtime model/)).toBeVisible();
  await page.getByRole("combobox", { name: "Voice model" }).click();
  await expect(page.getByRole("option", { name: /GPT Realtime 2\.1 Mini/ })).toHaveCount(0);
  await expect(page.getByRole("option", { name: /GPT Live 1/ })).toBeVisible();
});

test("unsaved changes: Cancel stays, Save draft saves and leaves, Don't save leaves", async ({ page }) => {
  const mock = await mockApi(page, { profiles: { receptionist: ready() } });
  await page.goto("./#/agents");
  await page.locator("main table").getByRole("link", { name: "Receptionist", exact: true }).click();
  await page.getByLabel("Greeting").fill("Changed");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(unsaved(page)).toContainText("Save the changes as a draft to continue editing them later.");
  await unsaved(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents\/receptionist$/);
  await expect(page.getByLabel("Greeting")).toHaveValue("Changed");
  await page.locator("#app").getByRole("button", { name: "Cancel", exact: true }).click();
  await unsaved(page).getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents$/);
  expect(mock.requests).toEqual(["PUT /profiles/receptionist"]);
  expect(mock.profiles.receptionist.draft.conversation.greeting).toBe("Changed");
  await page.locator("main table").getByRole("link", { name: "Receptionist", exact: true }).click();
  await page.getByLabel("Greeting").fill("Not kept");
  await page.getByRole("link", { name: "Provider trunks" }).click();
  await unsaved(page).getByRole("button", { name: "Don’t save", exact: true }).click();
  await expect(page).toHaveURL(/#\/trunks$/);
  expect(mock.requests).toEqual(["PUT /profiles/receptionist"]);
});

test("browser Back between two agent editors keeps the current agent when cancelled", async ({ page }) => {
  await mockApi(page, { profiles: { receptionist: ready(), night: ready({ agent_id: "night", name: "Night desk", kind: "custom" }) } });
  await page.goto("./#/agents");
  await page.locator("main table").getByRole("link", { name: "Receptionist", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Receptionist");
  // The address typed in the browser opens another editor.
  await page.evaluate(() => { location.hash = "#/agents/night"; });
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Night desk");
  await page.getByLabel("Greeting").fill("Night edits");
  await page.goBack();
  await expect(unsaved(page).getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await unsaved(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents\/night$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Night desk");
  await expect(page.getByLabel("Greeting")).toHaveValue("Night edits");
  // The history still works: Back now goes to the previous agent.
  await page.goBack();
  await unsaved(page).getByRole("button", { name: "Don’t save", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents\/receptionist$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Receptionist");
});

test("an expired session keeps the edits on the page and resumes the save after sign-in", async ({ page, context }) => {
  // The session expires at the first save and stays expired until the
  // Wizard stores a new key.
  let expired = false;
  const mock = await mockApi(page, {
    profiles: { receptionist: ready() },
    intercept: async (route, method, path) => {
      const renewed = route.request().headers().secretkey === "renewed";
      if (!renewed && (method === "PUT" || (expired && path === "/access"))) {
        expired = true;
        await route.fulfill({ status: 401, json: { error: "unauthorized" } });
        return true;
      }
      return false;
    },
  });
  await page.goto("./#/agents/receptionist");
  await page.getByLabel("Greeting").fill("Unsaved greeting");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Session expired" });
  await expect(dialog.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Greeting")).toHaveValue("Unsaved greeting");
  await expect(page.getByText("Administrator login required")).toHaveCount(0);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const popup = context.waitForEvent("page");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  const login = await popup;
  await login.evaluate(() => localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "renewed" })));
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  expect(mock.profiles.receptionist.draft.conversation.greeting).toBe("Unsaved greeting");
  expect(await page.evaluate(() => sessionStorage.getItem("nethvoice.agents.edit"))).toBeNull();
});

test("agent changed elsewhere: other fields merge by themselves, Discard loads the saved version", async ({ page }) => {
  const mock = await mockApi(page, { profiles: { receptionist: ready() } });
  await page.goto("./#/agents/receptionist");
  await expect(page.getByLabel("Greeting")).toHaveValue("Hello");
  // Someone else changes the greeting and the language.
  const other = mock.profiles.receptionist;
  mock.profiles.receptionist = { ...other, revision: 2, draft: { ...other.draft, conversation: { ...other.draft.conversation, greeting: "Saved elsewhere", language: "it" } } };
  await page.getByLabel("Conversation instructions").fill("My instructions");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  // No value changed on both sides: the changes merge without asking.
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  const dialog = page.getByRole("dialog").filter({ hasText: "Agent changed elsewhere" });
  await expect(dialog).toHaveCount(0);
  expect(mock.profiles.receptionist.revision).toBe(3);
  expect(mock.profiles.receptionist.draft.conversation).toMatchObject({ greeting: "Saved elsewhere", language: "it", instructions: "My instructions" });
  await expect(page.getByLabel("Greeting")).toHaveValue("Saved elsewhere");
  // The greeting changed on both sides: Discard loads the saved version.
  const saved = mock.profiles.receptionist;
  mock.profiles.receptionist = { ...saved, revision: 4, name: "Front desk", draft: { ...saved.draft, conversation: { ...saved.draft.conversation, greeting: "Front desk greeting" } } };
  await page.getByLabel("Greeting").fill("Lost edit");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog).toContainText("Agent Receptionist was saved somewhere else after you opened it.");
  await dialog.getByRole("button", { name: "Discard my changes", exact: true }).click();
  await expect(page.getByText("Saved settings loaded", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Front desk");
  await expect(page.getByLabel("Greeting")).toHaveValue("Front desk greeting");
  await expect(footer(page)).not.toHaveText("Unsaved changes");
});

test("a server validation error shows on its field, with no banner", async ({ page }) => {
  await mockApi(page, {
    profiles: { receptionist: ready() },
    intercept: async (route, method) => {
      if (method === "PUT") {
        await route.fulfill({ status: 422, json: { error: "invalid_configuration", field: "draft.max_call_duration_seconds" } });
        return true;
      }
      return false;
    },
  });
  await page.goto("./#/agents/receptionist");
  await page.getByLabel("Greeting").fill("Changed");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Check this value", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Maximum call duration")).toBeFocused();
  await expect(page.getByText("Cannot save agent")).toHaveCount(0);
});

test("publish checks what the agent needs and goes back to the list", async ({ page }) => {
  const mock = await mockApi(page, { profiles: { receptionist: profile() } });
  await page.goto("./#/agents/receptionist");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Select a provider trunk", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provider trunk" })).toBeFocused();
  await choose(page, "Provider trunk", /OpenAI production/);
  await expect(page.getByRole("combobox", { name: "Voice model" })).toHaveValue(/GPT Live 1/);
  await choose(page, "Voice", "Coral");
  await page.getByLabel("Conversation instructions").fill("Greet.");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  // Transfer is on with no destination: choose one, or turn it off.
  await expect(page.getByText("Select at least one queue or extension", { exact: true })).toBeVisible();
  await flip(page, "Transfer calls");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents$/);
  await expect(page.getByText("Agent published", { exact: true })).toBeVisible();
  expect(mock.requests).toEqual(["PUT /profiles/receptionist", "POST /profiles/receptionist/publish"]);
});

for (const scenario of ["one", "several", "none"] as const)
  test(`consult before connecting with ${scenario} published assistant(s)`, async ({ page }) => {
    const assistants = { one: [{ agent_id: "assistant", name: "Private assistant", workflow_version: 1 }], several: [{ agent_id: "assistant", name: "Private assistant", workflow_version: 1 }, { agent_id: "second", name: "Second assistant", workflow_version: 1 }], none: [] }[scenario];
    const mock = await mockApi(page, {
      assistants,
      profiles: { receptionist: ready(), draftassistant: profile({ agent_id: "draftassistant", name: "Draft assistant", kind: "custom", agent_type: "consultation" }) },
    });
    await page.goto("./#/agents/receptionist");
    if (!(await toggle(page, "Transfer calls").isChecked())) await flip(page, "Transfer calls");
    await page.getByRole("radio", { name: /Consult before connecting/ }).check();
    if (scenario === "one") {
      await expect(page.getByText("Colleagues are consulted by Private assistant.")).toBeVisible();
    } else if (scenario === "several") {
      await page.getByRole("button", { name: "Save draft", exact: true }).click();
      await expect(page.getByText("Select an internal consultation assistant", { exact: true })).toBeVisible();
      await choose(page, "Internal consultation assistant", "Second assistant");
    } else {
      await expect(page.getByText("No published internal consultation assistant")).toBeVisible();
      await page.getByRole("button", { name: "Go to the assistant" }).click();
      await unsaved(page).getByRole("button", { name: "Don’t save", exact: true }).click();
      await expect(page).toHaveURL(/#\/agents\/draftassistant$/);
      return;
    }
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
    expect(mock.profiles.receptionist.draft).toMatchObject({ contract_version: 9, role: "public", consultation: { mode: "attended", phone: true, chat: false, assistant_id: scenario === "one" ? "assistant" : "second" } });
    const transfer = mock.profiles.receptionist.draft.tool_bindings.find((b: { tool_id: string }) => b.tool_id === "pbx.transfer");
    expect(transfer.tool_version).toBe(3);
  });

test("a change saved elsewhere to other fields is merged without asking", async ({ page }) => {
  const mock = await mockApi(page, { profiles: { receptionist: ready() } });
  await page.goto("./#/agents/receptionist");
  await page.getByLabel(/^Greeting/).fill("Welcome to the office");
  // VisualPlan changes the fallback of the route, and the revision.
  const opened = mock.profiles.receptionist;
  mock.profiles.receptionist = { ...opened, revision: 2, draft: { ...opened.draft, fallback_destination_id: "ext-201" } };
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await expect(page.getByText("Agent changed elsewhere")).toHaveCount(0);
  expect(mock.profiles.receptionist.draft.conversation.greeting).toBe("Welcome to the office");
  expect(mock.profiles.receptionist.draft.fallback_destination_id).toBe("ext-201");
  expect(mock.profiles.receptionist.revision).toBe(3);
});

test("the same field changed elsewhere asks before saving", async ({ page }) => {
  const mock = await mockApi(page, { profiles: { receptionist: ready() } });
  await page.goto("./#/agents/receptionist");
  await page.getByLabel(/^Greeting/).fill("Welcome to the office");
  const opened = mock.profiles.receptionist;
  mock.profiles.receptionist = { ...opened, revision: 2, draft: { ...opened.draft, conversation: { ...opened.draft.conversation, greeting: "Good morning" } } };
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Agent changed elsewhere" });
  await expect(dialog).toContainText("Agent Receptionist was saved somewhere else after you opened it.");
  expect(mock.profiles.receptionist.draft.conversation.greeting).toBe("Good morning");
  await dialog.getByRole("button", { name: "Save my changes" }).click();
  await expect.poll(() => mock.profiles.receptionist.draft.conversation.greeting).toBe("Welcome to the office");
});
