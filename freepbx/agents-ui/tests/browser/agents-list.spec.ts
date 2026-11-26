import { expect, test } from "@playwright/test";
import { mockApi, openaiTrunk, profile } from "./agentsMock";

const notice = (page: import("@playwright/test").Page) =>
  page.getByTestId("setup-notice");

test("setup notice lists only the missing steps with their links", async ({ page }) => {
  const mock = await mockApi(page, { trunks: [] });
  await page.goto("./#/agents");
  await expect(notice(page)).toContainText("Agents can’t answer calls yet");
  await expect(notice(page).locator("li")).toHaveText([
    "Create a provider trunk: Provider trunks",
    "Publish an agent: Receptionist",
  ]);
  await expect(notice(page).getByRole("link", { name: "Receptionist" })).toHaveAttribute("href", "#/agents/receptionist");
  await expect(notice(page).getByRole("link", { name: "Provider trunks" })).toHaveAttribute("href", "#/trunks");
  // With the SIP lab, the trunk also needs its webhook.
  mock.trunks = [openaiTrunk];
  mock.sipLab = true;
  await page.reload();
  await expect(notice(page).locator("li")).toHaveText([
    "Configure the webhook of the provider trunk: Provider trunks",
    "Publish an agent: Receptionist",
  ]);
  // GPT-Live only: no webhook step; a published agent hides the notice.
  mock.sipLab = false;
  mock.profiles.receptionist = profile({ workflow_version: 1, enabled: true });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Receptionist", exact: true })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});

test("setup notice asks for a VisualPlan route from the in_use of the agents", async ({ page }) => {
  const assistant = profile({ agent_id: "assistant", name: "Assistant", agent_type: "consultation", in_use: false });
  const mock = await mockApi(page, {
    profiles: { receptionist: profile({ workflow_version: 1, enabled: true, in_use: false }), assistant },
  });
  await page.goto("./#/agents");
  // false: the step is missing.
  await expect(notice(page).locator("li")).toHaveText(["Use an agent in a VisualPlan route: Open VisualPlan"]);
  await expect(notice(page).getByRole("link", { name: "Open VisualPlan" })).toHaveAttribute("href", "/freepbx/visualplan/");
  // An unpublished agent in a route does not answer calls.
  mock.profiles.night = profile({ agent_id: "night", name: "Night desk", kind: "custom", in_use: true });
  await page.reload();
  await expect(notice(page).locator("li")).toHaveText(["Use an agent in a VisualPlan route: Open VisualPlan"]);
  // null (unknown) for every public agent: the step is omitted.
  delete mock.profiles.night;
  mock.profiles.receptionist.in_use = null;
  await page.reload();
  await expect(page.locator("main table").getByRole("link", { name: "Receptionist", exact: true })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
  // true: setup is complete, even with the other steps listed before.
  mock.profiles.receptionist.in_use = true;
  await page.reload();
  await expect(page.locator("main table").getByRole("link", { name: "Receptionist", exact: true })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});

test("Open VisualPlan opens the FreePBX session first, so that the first click reaches VisualPlan", async ({ page, context }) => {
  await mockApi(page, {
    profiles: { receptionist: profile({ workflow_version: 1, enabled: true, in_use: false }) },
  });
  const order: string[] = [];
  await context.route("**/freepbx/rest/login", async (route) => {
    order.push("login " + route.request().headers()["user"]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: { success: true } });
  });
  await context.route("**/freepbx/visualplan/", async (route) => {
    order.push("visualplan");
    await route.fulfill({ contentType: "text/html", body: "<title>VisualPlan</title>" });
  });
  await page.goto("./#/agents");
  for (const open of [
    () => page.getByRole("button", { name: "Open VisualPlan", exact: true }).click(),
    () => notice(page).getByRole("link", { name: "Open VisualPlan" }).click(),
  ]) {
    order.length = 0;
    const popup = context.waitForEvent("page");
    await open();
    const tab = await popup;
    await expect(tab).toHaveURL(/\/freepbx\/visualplan\/$/);
    expect(order).toEqual(["login administrator", "visualplan"]);
    // The new tab cannot reach the agents page.
    expect(await tab.evaluate(() => window.opener)).toBeNull();
    await tab.close();
  }
});

test("list shows built-in badge, filters and row menus", async ({ page }) => {
  await mockApi(page, {
    profiles: {
      receptionist: profile({ workflow_version: 2, draft_version: 2, enabled: true, routable: true, draft: { ...profile().draft, provider_binding_id: "trunk_openai" } }),
      custom: profile({ agent_id: "custom", name: "Night desk", kind: "custom" }),
      assistant: profile({ agent_id: "assistant", name: "Private assistant", kind: "custom", agent_type: "consultation" }),
    },
  });
  await page.goto("./#/agents");
  const table = page.locator("main table");
  await expect(table.getByText("Built-in", { exact: true })).toHaveCount(1);
  await expect(table).toContainText("OpenAI production");
  await expect(table.getByText("Not selected")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Reset filters" })).toBeDisabled();
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await page.getByRole("checkbox", { name: "Internal consultation assistant" }).check();
  await page.keyboard.press("Escape");
  await expect(table.getByRole("link")).toHaveText(["Private assistant"]);
  await page.getByRole("button", { name: "Reset filters" }).first().click();
  await page.getByRole("button", { name: "Status", exact: true }).click();
  await page.getByRole("checkbox", { name: "Published" }).check();
  await page.keyboard.press("Escape");
  await expect(table.getByRole("link")).toHaveText(["Receptionist"]);
  await page.getByPlaceholder("Filter agents").fill("nothing matches");
  await expect(page.getByText("No agents found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).last().click();
  // Built-in agents have no Delete; custom ones do.
  const menus = page.getByRole("button", { name: "Open menu" });
  await menus.first().click();
  await expect(page.getByRole("menuitem", { name: "View monitoring" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  await page.getByRole("heading", { name: "Agents" }).click();
  await menus.nth(1).click();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Test call" })).toHaveCount(0);
  await page.getByRole("heading", { name: "Agents" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
