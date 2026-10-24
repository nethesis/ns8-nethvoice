import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const base = new URL(
  "../../../var/www/html/freepbx/rest/lib/agents/contracts/",
  import.meta.url,
);
const read = (name: string) =>
  JSON.parse(readFileSync(new URL(name, base), "utf8"));
const tools = read("tools-v5.json");
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
test("hangup starts disabled and is enabled and saved per agent", async ({
  page,
}) => {
  const record = {
    agent_id: "test",
    name: "Test",
    kind: "custom",
    revision: 1,
    workflow_version: null,
    published: null,
    draft: draft(),
  };
  const original = structuredClone(record.draft);
  const writes: unknown[] = [];
  await page.addInitScript(() => {
    localStorage.setItem(
      "secretkey",
      JSON.stringify({ user: "administrator", hash: "synthetic" }),
    );
    localStorage.setItem("nethvoice.agents.language", "en");
  });
  await page.route("**/freepbx/rest/agents/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/agents")[1];
    if (route.request().method() === "PUT") {
      expect(route.request().headers()["x-agents-csrf"]).toBe("synthetic-csrf");
      record.draft = route.request().postDataJSON().profile.draft;
      record.revision++;
      writes.push(structuredClone(record.draft));
    }
    await route.fulfill({
      json:
        path === "/access"
          ? { csrf: "synthetic-csrf" }
          : path === "/catalog"
            ? {
                tools,
                draft_defaults: draft(),
                extensions: [],
                default_language: "en",
                providers: ["openai"],
                languages: [{ id: "en", label: "English" }],
              }
            : path === "/trunks"
              ? { items: [] }
              : path === "/destinations"
                ? {
                    items: [],
                    next_offset: null,
                    modules: {},
                    unavailable_ids: [],
                  }
                : record,
    });
  });
  await page.goto("./#/agents/test");
  const enabled = page.getByRole("checkbox", {
    name: "End the call",
    exact: true,
  });
  await expect(enabled).not.toBeChecked();
  await expect(
    page.getByLabel("Maximum goodbye playback (seconds)", { exact: true }),
  ).toHaveCount(0);
  expect(writes).toHaveLength(0);
  expect(record.draft).toEqual(original);
  await enabled.locator("..").click();
  await page
    .getByLabel("Maximum goodbye playback (seconds)", { exact: true })
    .fill("4");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(record.draft.contract_version).toBe(8);
  expect(record.draft.tool_bindings.slice(0, 3)).toEqual(
    original.tool_bindings.slice(0, 3),
  );
  expect(record.draft.tool_bindings[3]).toEqual({
    tool_id: "telephony.hangup",
    tool_version: 1,
    enabled: true,
    config: { playback_timeout_seconds: 4 },
  });
  expect(record.published).toBeNull();
});
