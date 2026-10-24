import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = new URL(
  "../../../var/www/html/freepbx/rest/lib/agents/contracts/",
  import.meta.url,
);
const read = (name: string) =>
  JSON.parse(readFileSync(new URL(name, base), "utf8"));
const tools = read("tools-v5.json");
tools[0].editor = tools[2].editor = { automatic: true };
tools[1].editor = {
  descriptions_field: "descriptions",
  categories: [
    {
      enabled_field: "extensions_enabled",
      destinations_field: "extension_allowlist",
      inventory: "extensions",
      selection: "allowlist",
    },
    {
      enabled_field: "queues_enabled",
      destinations_field: "queue_denylist",
      inventory: "queues",
      selection: "denylist",
    },
    {
      enabled_field: "recent_callers_enabled",
      destinations_field: "recent_caller_denylist",
      inventory: "extensions",
      selection: "denylist",
      fields: ["recent_caller_lookback_days"],
      descriptions: false,
    },
  ],
};
function draft() {
  const value = read("published-v8.example.json");
  for (const key of [
    "agent_id",
    "destination_id",
    "workflow_version",
    "provider",
  ])
    delete value[key];
  value.provider_binding_id = null;
  return value;
}
const toggle = (page: Page, name: string) =>
  page.getByRole("checkbox", { name, exact: true });

async function fixture(page: Page) {
  const record = {
    agent_id: "test",
    name: "Test",
    kind: "custom",
    revision: 1,
    draft_version: 1,
    workflow_version: null,
    sync_status: "synced",
    draft: draft(),
    published: null,
  };
  let writes = 0;
  await page.addInitScript(() => {
    localStorage.setItem(
      "secretkey",
      JSON.stringify({ user: "administrator", hash: "synthetic" }),
    );
    localStorage.setItem("nethvoice.agents.language", "en");
  });
  await page.route("**/freepbx/rest/agents/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.split("/agents")[1];
    if (req.method() === "PUT") {
      expect(req.headers()["x-agents-csrf"]).toBe("synthetic-csrf");
      record.draft = req.postDataJSON().profile.draft;
      record.revision++;
      writes++;
    }
    if (path === "/destinations") {
      const items =
        url.searchParams.get("type") === "extension"
          ? [
              {
                id: "extension:203",
                type: "extension",
                name: "Alice",
                available: true,
              },
            ]
          : [];
      await route.fulfill({
        json: {
          items,
          next_offset: null,
          modules: { extension: true },
          unavailable_ids: [],
        },
      });
      return;
    }
    await route.fulfill({
      json:
        path === "/access"
          ? { csrf: "synthetic-csrf" }
          : path === "/catalog"
            ? {
                tools: tools,
                draft_defaults: draft(),
                extensions: [],
                default_language: "en",
                providers: ["openai"],
                languages: [{ id: "en", label: "English" }],
              }
            : path === "/trunks"
              ? { items: [] }
              : record,
    });
  });
  await page.goto("./#/agents/test");
  return { record, writes: () => writes };
}

test("recent callbacks default on with seven days and independent extension exclusions", async ({
  page,
}) => {
  const state = await fixture(page);
  await expect(
    toggle(page, "Transfer to a permitted PBX destination"),
  ).toBeChecked();
  await expect(toggle(page, "Direct extensions")).not.toBeChecked();
  await expect(toggle(page, "Recent callbacks")).toBeChecked();
  await expect(
    page.getByLabel("Recent-call lookback (days)", { exact: true }),
  ).toHaveValue("7");
  await expect(toggle(page, "Alice (203)")).toBeChecked();
  await expect(
    page.getByLabel("Additional description (optional)"),
  ).toHaveCount(0);
  await toggle(page, "Alice (203)").locator("..").click();
  await page
    .getByLabel("Recent-call lookback (days)", { exact: true })
    .fill("10");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  expect(
    state.record.draft.tool_bindings[1].config.recent_caller_denylist,
  ).toEqual(["extension:203"]);
  expect(
    state.record.draft.tool_bindings[1].config.extension_allowlist,
  ).toEqual([]);
  expect(
    state.record.draft.tool_bindings[1].config.recent_caller_lookback_days,
  ).toBe(10);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/voice-agent-recent-callbacks.png",
    fullPage: true,
  });
});
