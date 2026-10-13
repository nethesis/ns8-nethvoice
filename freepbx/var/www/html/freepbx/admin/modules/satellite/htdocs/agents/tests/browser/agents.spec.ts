import { expect, test, type Page } from "@playwright/test";
import { blankGraph, objectSchema } from "../../src/model";

const graph = blankGraph("reception", "Reception", "voice");
graph.provider_binding_ref = "1";
graph.fallback = "ext-queues,4000,1";
graph.nodes[1]!.config.prompt = "Help the caller.";
const tool = {
  name: "Create ticket",
  description: "Record a support request",
  kind: "api",
  execution_policy: "direct",
  input_schema: objectSchema(),
  output_schema: objectSchema(),
  timeout_seconds: 10,
  config: {
    operation: { connector_id: "crm", operation_id: "write", version: 1 },
  },
};
graph.tool_bindings = [
  {
    tool_id: "tickets",
    version: 1,
    conversation: true,
    workflow: true,
    scope: {},
    instructions: "",
  },
];
const blocks = [
  {
    type: "start.call",
    version: 1,
    entrypoints: ["voice"],
    outcomes: ["success"],
    config_schema: objectSchema(),
    input_schema: objectSchema(),
  },
  {
    type: "conversation.collect",
    version: 1,
    entrypoints: ["voice", "api"],
    outcomes: ["error", "timeout"],
    config_schema: objectSchema(),
    input_schema: objectSchema(),
  },
  {
    type: "end",
    version: 1,
    entrypoints: ["voice", "api"],
    outcomes: [],
    config_schema: objectSchema(),
    input_schema: objectSchema(),
  },
];
const inventory = {
  agents: [
    {
      agent_id: "reception",
      name: "Reception",
      kind: "agent",
      status: "ready",
      entrypoints: ["voice"],
      version: 1,
      revision: 2,
      enabled: true,
      draft: graph,
      routing_usage: [{ name: "7777" }],
    },
  ],
  definitions: [],
  bindings: [{ id: "1", name: "OpenAI" }],
  blocks,
  routing_objects: [],
  fallback_destinations: [
    { id: "ext-queues,4000,1", label: "Support queue · 4000" },
  ],
  connector_operations: [],
  data_sources: [],
  tools: [
    { tool_id: "tickets", revision: 2, published_version: 1, draft: tool },
  ],
  tool_versions: [
    { tool_id: "tickets", version: 1, revoked: false, definition: tool },
  ],
  dependencies: [],
};

async function installFixtures(page: Page) {
  const state = structuredClone(inventory);
  await page.addInitScript(() =>
    localStorage.setItem(
      "secretkey",
      JSON.stringify({ user: "administrator", hash: "synthetic-test-only" }),
    ),
  );
  await page.route("**/freepbx/rest/agents/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/freepbx/rest/agents",
      "",
    );
    const replies: Record<string, unknown> = {
      "/access": {
        csrf: "synthetic-csrf",
        scopes: [
          "metadata",
          "transcripts",
          "policy",
          "connectors",
          "api_access",
        ],
      },
      "/application/workflows/inventory": state,
      "/application/workflows/catalog": {
        blocks,
        templates: [],
        connector_presets: [],
      },
      "/application/inventory": {
        enabled: true,
        resources: [],
        versions: [],
        secrets: [],
        grants: [],
        clients: [],
      },
      "/native/inventory": {
        profiles: [],
        trunks: [],
        tools: [],
        permissions: [],
        fallback_destinations: inventory.fallback_destinations,
      },
      "/policy": {
        policy: {
          metadata_retention_days: 30,
          transcript_retention_days: 7,
          transcripts: { internal: false, external: false },
        },
        sync: { desired_revision: 1 },
      },
      "/application/workflows/activity": {
        runs: [],
        counts: [],
        history_available: true,
      },
      "/application/workflows/simulations": {
        run_id: "mock-run",
        status: "completed",
        test_mode: "mock",
        trace: [{ node_id: "conversation", outcome: "resolved" }],
      },
      "/application/workflows/validate": { valid: true },
    };
    let response = replies[path];
    if (route.request().method() === "PUT" && path.includes("/definitions/")) {
      expect(route.request().headers()["x-agents-csrf"]).toBe("synthetic-csrf");
      const body = route.request().postDataJSON();
      expect(body.definition.nodes[0].inputs).toEqual({});
      const revision = body.expected_revision + 1;
      const existing = state.agents.find(
        (agent) => agent.agent_id === body.definition.agent_id,
      );
      if (existing) {
        existing.draft = body.definition;
        existing.revision = revision;
      } else
        state.agents.push({
          agent_id: body.definition.agent_id,
          name: body.definition.name,
          kind: "agent",
          status: "draft",
          entrypoints: body.definition.entrypoints,
          version: 0,
          revision,
          enabled: false,
          draft: body.definition,
          routing_usage: [],
        });
      response = { revision };
    }
    if (response === undefined)
      throw new Error("Missing browser fixture: " + path);
    await route.fulfill({ json: response });
  });
}

test("catalogs, dark and light theme, Italian labels and empty source state", async ({
  page,
}) => {
  await installFixtures(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/agents");
  await expect(
    page.getByRole("heading", { name: "Agents", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("gridcell", { name: "Reception", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/nethvoice-agents-catalog-dark.png" });
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass("dark");
  for (const section of ["tools", "sources", "activity", "settings"]) {
    await page.goto("/#/" + section);
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.goto("/#/sources");
  await expect(page.getByText("No matching items")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("it");
  await expect(
    page.getByRole("heading", { name: "Sorgenti dati" }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/nethvoice-agents-sources-light-it.png" });
  expect(errors).toEqual([]);
});

test("agent tabs, canvas, tools and offline test work", async ({ page }) => {
  await installFixtures(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/agents/reception/general");
  await expect(
    page.getByRole("heading", { name: "Reception", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Workflow", exact: true }).click();
  await expect(page.locator(".vue-flow__node")).toHaveCount(4);
  await page.screenshot({ path: "/tmp/nethvoice-agents-workflow-dark.png" });
  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create ticket · v1", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Test", exact: true }).click();
  await page
    .getByRole("button", { name: "Run simulation", exact: true })
    .click();
  await expect(
    page.getByText("completed", { exact: false }).last(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("unauthenticated view offers Wizard sign-in", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(
    page.getByRole("button", { name: "Sign in through Wizard", exact: true }),
  ).toBeVisible();
});

test("create and save an agent using the Wizard credential and CSRF contract", async ({
  page,
}) => {
  await installFixtures(page);
  await page.goto("/#/agents/new");
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Test reception");
  await page
    .getByRole("button", { name: "Create and configure", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/agents\/a-test-reception-/);
  await expect(
    page.getByRole("heading", { name: "Test reception", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Goal", exact: true })
    .fill("Help callers find the support queue.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(
    0,
  );
});

test("tab keyboard navigation and tool removal retain draft control", async ({
  page,
}) => {
  await installFixtures(page);
  await page.goto("/#/agents/reception/general");
  const general = page.getByRole("tab", { name: "General", exact: true });
  await general.focus();
  await general.press("ArrowRight");
  await expect(page).toHaveURL(/\/workflow$/);
  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create ticket · v1", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
});

test("a late access response cannot undo sign-out in another tab", async ({
  page,
}) => {
  await installFixtures(page);
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/freepbx/rest/agents/access", async (route) => {
    started();
    await response;
    await route.fulfill({
      json: { csrf: "synthetic-csrf", scopes: ["metadata"] },
    });
  });
  await page.goto("/#/agents");
  await waiting;
  await page.evaluate(() => {
    localStorage.removeItem("secretkey");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "secretkey", newValue: null }),
    );
  });
  release();
  await expect(
    page.getByRole("button", { name: "Sign in through Wizard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("gridcell", { name: "Reception", exact: true }),
  ).toHaveCount(0);
});
