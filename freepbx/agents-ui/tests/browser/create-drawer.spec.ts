import { expect, test, type Page } from "@playwright/test";
import { choose, drawer, flip, mockApi, openaiTrunk, toggle } from "./agentsMock";

const button = (page: Page, name: string) =>
  drawer(page).getByRole("button", { name, exact: true });

test("basic voice agent: three steps, Next checks the step, Publish jumps to the first error", async ({ page }) => {
  const mock = await mockApi(page);
  await page.goto("./#/agents");
  await page.getByRole("button", { name: "Create agent", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents\/new$/);
  await expect(drawer(page).getByText("Step 1/3")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Agent type" })).toHaveValue("Basic voice");
  // The only trunk is preselected; the default language comes from the PBX.
  await expect(page.getByRole("combobox", { name: "Provider trunk" })).toHaveValue(/OpenAI production/);
  await expect(page.getByRole("combobox", { name: "Default language" })).toHaveValue("Italiano (it)");
  await button(page, "Next").click();
  await expect(page.getByText("Enter a name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("Front desk");
  await button(page, "Next").click();
  await expect(drawer(page).getByText("Step 2/3")).toBeVisible();
  // SIP lab off: only GPT-Live, preselected.
  await expect(page.getByRole("combobox", { name: "Voice model" })).toHaveValue(/GPT Live 1/);
  await page.getByRole("combobox", { name: "Voice model" }).click();
  await expect(page.getByRole("option")).toHaveText([/GPT Live 1.*Fastest answers/]);
  await page.keyboard.press("Escape");
  // GPT-Live settings are collapsed under Advanced settings.
  await expect(page.getByRole("button", { name: "Advanced settings" })).toBeVisible();
  await expect(page.getByText("Reasoning effort", { exact: true })).toBeHidden();
  // Voice and instructions are required: Next stays on step 2.
  await button(page, "Next").click();
  await expect(drawer(page).getByText("Step 2/3")).toBeVisible();
  await expect(page.getByText("Select a voice", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter the conversation instructions", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Voice", exact: true })).toBeFocused();
  await choose(page, "Voice", "Coral");
  await page.getByLabel("Conversation instructions").fill("Greet and transfer.");
  await button(page, "Next").click();
  await expect(drawer(page).getByText("Step 3/3")).toBeVisible();
  // Transfer starts off for new agents.
  await expect(toggle(page, "Transfer calls")).not.toBeChecked();
  await flip(page, "Transfer calls");
  await button(page, "Publish").click();
  await expect(page.getByText("Select at least one queue or extension", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Queues", exact: true }).click();
  await page.getByRole("option", { name: /Sales/ }).click();
  await drawer(page).getByText("Step 3/3").click();
  await page.getByRole("radio", { name: /Consult before connecting/ }).check();
  await expect(page.getByText("No published internal consultation assistant")).toBeVisible();
  await page.getByRole("radio", { name: /Direct transfer/ }).check();
  await button(page, "Publish").click();
  await expect(page).toHaveURL(/#\/agents$/);
  await expect(page.getByText("Agent published", { exact: true })).toBeVisible();
  expect(mock.requests).toEqual(["POST /profiles", "POST /profiles/agent_new/publish"]);
  const created = mock.profiles.agent_new;
  expect(created.draft.conversation).toMatchObject({ model: "gpt-live-1", voice: "coral", language: "it" });
  const transfer = created.draft.tool_bindings.find((b: { tool_id: string }) => b.tool_id === "pbx.transfer");
  expect(transfer.enabled).toBe(true);
  expect(transfer.config).toMatchObject({ queues_enabled: true, queue_allowlist: ["queue:401"], extensions_enabled: false });
});

test("Next needs the provider trunk and shows the next step from its title", async ({ page }) => {
  await mockApi(page, {
    trunks: [openaiTrunk, { ...openaiTrunk, binding_id: "trunk_test", name: "OpenAI test" }],
  });
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("./#/agents/new");
  // Two trunks: none is preselected.
  await expect(page.getByRole("combobox", { name: "Provider trunk" })).toHaveValue("");
  await page.getByLabel("Name", { exact: true }).fill("Front desk");
  await button(page, "Next").click();
  await expect(drawer(page).getByText("Step 1/3")).toBeVisible();
  await expect(page.getByText("Select a provider trunk", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provider trunk" })).toBeFocused();
  await choose(page, "Provider trunk", /OpenAI test/);
  await expect(page.getByText("Select a provider trunk", { exact: true })).toHaveCount(0);
  await button(page, "Next").click();
  await expect(drawer(page).getByText("Step 2/3")).toBeVisible();
  // The drawer starts from the top, with the focus on the title of the step.
  await expect(drawer(page).getByTestId("step-heading")).toBeFocused();
  await expect(drawer(page).getByTestId("step-heading")).toHaveText("Conversation");
  await expect(page.getByRole("button", { name: "Close side drawer" })).toBeInViewport();
  // Required fields carry no Optional label; optional ones do.
  await expect(drawer(page).getByText("Optional", { exact: true })).toHaveCount(1);
  // Scrolled down, Next back from step 3 starts again from the top.
  await choose(page, "Voice", "Coral");
  await page.getByLabel("Conversation instructions").fill("Greet and transfer.");
  await button(page, "Next").click();
  await expect(drawer(page).getByTestId("step-heading")).toHaveText("Tools");
  await expect(page.getByRole("button", { name: "Close side drawer" })).toBeInViewport();
  await button(page, "Previous").click();
  await expect(drawer(page).getByTestId("step-heading")).toBeFocused();
  await expect(page.getByRole("button", { name: "Close side drawer" })).toBeInViewport();
});

test("SIP lab on: SIP Realtime models are offered and the provider default is preselected", async ({ page }) => {
  await mockApi(page, { sipLab: true });
  await page.goto("./#/agents/new");
  await page.getByLabel("Name", { exact: true }).fill("Front desk");
  await button(page, "Next").click();
  await expect(page.getByRole("combobox", { name: "Voice model" })).toHaveValue(/GPT Realtime 2.1/);
  await page.getByRole("combobox", { name: "Voice model" }).click();
  await expect(page.getByRole("option", { name: /GPT Realtime 2.1 Mini.*Good quality, lower cost/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /^GPT Realtime 2\.1\s*Best quality, highest cost$/ })).toBeVisible();
});

test("internal consultation assistant: two steps with the built-in instructions", async ({ page }) => {
  await mockApi(page);
  await page.goto("./#/agents/new?type=consultation");
  await expect(page.getByRole("combobox", { name: "Agent type" })).toHaveValue("Internal consultation assistant");
  await expect(drawer(page).getByText("Step 1/2")).toBeVisible();
  await expect(page.getByLabel("Maximum call duration")).toHaveValue("60");
  await page.getByLabel("Name", { exact: true }).fill("Private assistant");
  await button(page, "Next").click();
  await expect(page.getByLabel("Conversation instructions")).toHaveValue(/internal call consultation assistant/);
  await expect(button(page, "Publish")).toBeVisible();
  await expect(button(page, "Next")).toHaveCount(0);
});

test("CleverAI: one step without stepper, created with Create", async ({ page }) => {
  const mock = await mockApi(page, {
    sipLab: true,
    trunks: [{ binding_id: "trunk_clever", name: "CleverAI transport", provider: "cleverai", revision: 1, sync_status: "synced", api_key_configured: false, api_key_source: "missing", webhook_secret_configured: false }],
  });
  await page.goto("./#/agents/new");
  await choose(page, "Agent type", /^CleverAI/);
  await expect(drawer(page).getByText(/Step \d/)).toHaveCount(0);
  for (const label of ["Default language", "Maximum call duration"]) await expect(page.getByLabel(label)).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Provider trunk" })).toHaveValue(/CleverAI transport/);
  await page.getByLabel("Name", { exact: true }).fill("External");
  await button(page, "Create").click();
  await expect(page).toHaveURL(/#\/agents$/);
  expect(mock.requests).toEqual(["POST /profiles"]);
  expect(mock.profiles.agent_new.draft).toEqual({ execution: "cleverai", provider_binding_id: "trunk_clever", fallback_destination_id: "hangup" });
});

test("Cancel with changes offers Save draft, Don't save and Cancel", async ({ page }) => {
  const mock = await mockApi(page);
  await page.goto("./#/agents");
  await page.getByRole("button", { name: "Create agent", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Night desk");
  await button(page, "Cancel").click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Unsaved changes" });
  await expect(dialog).toContainText("Save the agent as a draft to continue editing it later.");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Night desk");
  // Browser Back asks too, and Cancel keeps the drawer and its address.
  await page.goBack();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents\/new$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Night desk");
  await button(page, "Cancel").click();
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents$/);
  await expect(page.getByText("Agent saved as draft", { exact: true })).toBeVisible();
  expect(mock.requests).toEqual(["POST /profiles"]);
  // Don't save discards.
  await page.getByRole("button", { name: "Create agent", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Discarded");
  await page.getByRole("button", { name: "Close side drawer" }).click();
  await dialog.getByRole("button", { name: "Don’t save", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents$/);
  expect(mock.requests).toEqual(["POST /profiles"]);
});

test("a server rejection of the publication opens the saved draft with the error on its field", async ({ page }) => {
  const mock = await mockApi(page, {
    intercept: async (route, method, path) => {
      if (method === "POST" && path.endsWith("/publish")) {
        await route.fulfill({ status: 422, json: { error: "webhook_not_configured", field: "draft.provider_binding_id" } });
        return true;
      }
      return false;
    },
  });
  await page.goto("./#/agents/new");
  await page.getByLabel("Name", { exact: true }).fill("Front desk");
  await button(page, "Next").click();
  await choose(page, "Voice", "Coral");
  await page.getByLabel("Conversation instructions").fill("Greet and transfer.");
  await button(page, "Next").click();
  await button(page, "Publish").click();
  await expect(page).toHaveURL(/#\/agents\/agent_new$/);
  await expect(page.getByText(/The webhook of this trunk is not configured/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provider trunk" })).toBeFocused();
  await expect(page.getByText("Agent saved as draft", { exact: true })).toBeVisible();
  expect(mock.requests).toEqual(["POST /profiles", "POST /profiles/agent_new/publish"]);
  // Back goes to the list, not to the drawer.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/#\/agents$/);
});

test("a server field error on create stays in the drawer on the step of the field", async ({ page }) => {
  await mockApi(page, {
    intercept: async (route, method, path) => {
      if (method === "POST" && path === "/profiles") {
        await route.fulfill({ status: 422, json: { error: "invalid_configuration", field: "draft.conversation.language" } });
        return true;
      }
      return false;
    },
  });
  await page.goto("./#/agents/new");
  await page.getByLabel("Name", { exact: true }).fill("Front desk");
  await button(page, "Next").click();
  await choose(page, "Voice", "Coral");
  await page.getByLabel("Conversation instructions").fill("Greet.");
  await button(page, "Next").click();
  await button(page, "Publish").click();
  await expect(drawer(page).getByText("Step 1/3")).toBeVisible();
  await expect(page.getByText("Check this value", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Default language" })).toBeFocused();
  await expect(drawer(page).getByText("Cannot publish agent")).toHaveCount(0);
});

test("an expired session keeps the drawer input and resumes the publication after sign-in", async ({ page, context }) => {
  let expire = true;
  const mock = await mockApi(page, {
    intercept: async (route, method, path) => {
      if (expire && method === "POST" && path === "/profiles") {
        expire = false;
        await route.fulfill({ status: 401, json: { error: "unauthorized" } });
        return true;
      }
      return false;
    },
  });
  await page.goto("./#/agents/new");
  await page.getByLabel("Name", { exact: true }).fill("Front desk");
  await button(page, "Next").click();
  await choose(page, "Voice", "Coral");
  await page.getByLabel("Conversation instructions").fill("Greet.");
  await button(page, "Next").click();
  await button(page, "Publish").click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Session expired" });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await expect(page.getByText("Administrator login required")).toHaveCount(0);
  const popup = context.waitForEvent("page");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  const login = await popup;
  expect(login.url()).toContain("/freepbx/wizard/#!/login");
  await login.evaluate(() => localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "renewed" })));
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/#\/agents$/);
  await expect(page.getByText("Agent published", { exact: true })).toBeVisible();
  expect(mock.profiles.agent_new.name).toBe("Front desk");
});

test("drawer fits a phone screen", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/agents/new");
  await expect(drawer(page).getByText("Step 1/3")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
