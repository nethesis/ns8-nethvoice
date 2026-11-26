import { expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";

// Synthetic REST API for the agent list, the Create agent drawer and the
// agent page.
const base = new URL(
  "../../../var/www/html/freepbx/rest/lib/agents/contracts/",
  import.meta.url,
);
export const read = (file: string) =>
  JSON.parse(readFileSync(new URL(file, base), "utf8"));
const capabilities = read("provider-models-v2.json");
export const tools = read("tools-v5.json");
export const modelCatalog = {
  items: capabilities.openai.models,
  backend_models: capabilities.openai.backend_models,
  default_model: capabilities.openai.default,
  source: "provider_api",
  selection: "selectable",
};
const consultationInstructions =
  "You are the internal call consultation assistant.";

export function emptyDraft() {
  return {
    contract_version: 8,
    provider_binding_id: null as string | null,
    conversation: {
      language: "en",
      voice: "",
      greeting: "",
      instructions: "",
      model: null as string | null,
      options: null as Record<string, string | number> | null,
    },
    tool_bindings: tools.map(
      (tool: { id: string; version: number; defaults: unknown }) => ({
        tool_id: tool.id,
        tool_version: tool.version,
        enabled: tool.id !== "telephony.hangup",
        config: structuredClone(tool.defaults),
      }),
    ),
    fallback_destination_id: "hangup",
    max_call_duration_seconds: 600,
    debug: { transcription_enabled: false, retention_hours: 24 },
  } as Record<string, any>;
}
export function consultationDraft() {
  const draft = emptyDraft();
  draft.conversation.instructions = consultationInstructions;
  draft.max_call_duration_seconds = 60;
  draft.contract_version = 9;
  draft.role = "consultation";
  draft.chat_model = null;
  draft.consultation = {
    mode: "direct",
    phone: false,
    chat: false,
    assistant_id: null,
  };
  for (const binding of draft.tool_bindings) {
    binding.enabled = false;
    if (binding.tool_id === "pbx.transfer") binding.tool_version = 3;
  }
  return draft;
}

export type Profile = Record<string, any>;
export function profile(values: Partial<Profile> = {}): Profile {
  return {
    agent_id: "receptionist",
    agent_type: "basic_voice",
    name: "Receptionist",
    kind: "builtin",
    destination_id: "agent:receptionist",
    enabled: false,
    revision: 1,
    workflow_version: null,
    draft_version: 1,
    sync_status: "synced",
    routable: false,
    published: null,
    draft: emptyDraft(),
    ...values,
  };
}
export const openaiTrunk = {
  binding_id: "trunk_openai",
  name: "OpenAI production",
  provider: "openai",
  revision: 1,
  sync_status: "synced",
  openai_project_id: "proj_test",
  api_key_configured: true,
  api_key_source: "stored",
  webhook_secret_configured: false,
  webhook_status: "not_configured",
};

export interface Mock {
  sipLab: boolean;
  trunks: Record<string, unknown>[];
  profiles: Record<string, Profile>;
  assistants: { agent_id: string; name: string; workflow_version: number }[];
  requests: string[];
  // Answers a request before the default handlers, or returns false.
  intercept?: (
    route: Route,
    method: string,
    path: string,
    body: any,
  ) => Promise<boolean> | boolean;
}

export async function mockApi(
  page: Page,
  options: Partial<Mock> = {},
  language = "en",
): Promise<Mock> {
  const mock: Mock = {
    sipLab: false,
    trunks: [openaiTrunk],
    profiles: { receptionist: profile() },
    assistants: [],
    requests: [],
    ...options,
  };
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript((language) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "secretkey",
      JSON.stringify({ user: "administrator", hash: "synthetic" }),
    );
    localStorage.setItem("nethvoice.agents.language", language);
  }, language);
  let created = 0;
  await page.route("**/freepbx/rest/agents/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/freepbx/rest/agents", "");
    const method = request.method();
    const body = method === "GET" ? undefined : request.postDataJSON();
    if (method !== "GET" && path.startsWith("/profiles"))
      mock.requests.push(method + " " + path);
    if (mock.intercept && (await mock.intercept(route, method, path, body)))
      return;
    if (path === "/access")
      return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path === "/catalog")
      return route.fulfill({
        json: {
          sip_lab_enabled: mock.sipLab,
          agent_types: [
            { id: "basic_voice", name: "Basic Voice" },
            { id: "consultation", name: "Internal consultation assistant" },
            { id: "cleverai", name: "CleverAI" },
          ],
          tools,
          draft_defaults: emptyDraft(),
          consultation_defaults: consultationDraft(),
          consultation_assistants: mock.assistants,
          extensions: [],
          providers: mock.sipLab ? ["openai", "grok", "cleverai"] : ["openai"],
          default_language: "it",
          languages: [
            { id: "it", label: "Italiano (it)" },
            { id: "en", label: "English (en)" },
          ],
          provider_credentials: { openai: { environment_available: true } },
        },
      });
    if (path === "/trunks") return route.fulfill({ json: { items: mock.trunks } });
    if (path === "/trunks/models")
      return route.fulfill({ json: modelCatalog });
    if (path.endsWith("/voices"))
      return route.fulfill({ json: { items: [{ id: "ara", label: "Ara" }] } });
    if (path === "/destinations") {
      const type = url.searchParams.get("type");
      const items =
        type === "queue"
          ? [
              { id: "queue:401", name: "Sales", type: "queue", available: true },
              { id: "queue:402", name: "Support", type: "queue", available: true },
            ]
          : [
              { id: "extension:201", name: "Alice", type: "extension", available: true },
              { id: "extension:202", name: "Bob", type: "extension", available: true },
            ];
      return route.fulfill({
        json: { items, next_offset: null, total: items.length, modules: {}, unavailable_ids: [] },
      });
    }
    if (path === "/profiles" && method === "GET")
      return route.fulfill({ json: { items: Object.values(mock.profiles) } });
    if (path === "/profiles" && method === "POST") {
      expect(body.expected_revision).toBe(0);
      const id = "agent_new" + (created++ ? created : "");
      const external = body.profile.draft.execution === "cleverai";
      const consultation = body.profile.draft.role === "consultation";
      mock.profiles[id] = profile({
        agent_id: id,
        kind: "custom",
        name: body.profile.name,
        destination_id: "agent:" + id,
        agent_type: external ? "cleverai" : consultation ? "consultation" : "basic_voice",
        enabled: external,
        routable: external,
        draft_version: external ? null : 1,
        draft: body.profile.draft,
      });
      return route.fulfill({ json: mock.profiles[id] });
    }
    const match = path.match(/^\/profiles\/([a-z0-9_]+)(\/publish)?$/);
    if (match) {
      const record = mock.profiles[match[1]];
      if (!record) return route.fulfill({ status: 404, json: { error: "agent_not_found" } });
      if (method === "PUT") {
        if (body.expected_revision !== record.revision)
          return route.fulfill({ status: 409, json: { error: "revision_conflict" } });
        mock.profiles[match[1]] = {
          ...record,
          name: body.profile.name,
          draft: body.profile.draft,
          revision: record.revision + 1,
          draft_version: (record.workflow_version || 0) + 1,
        };
      } else if (match[2]) {
        if (body.expected_revision !== record.revision)
          return route.fulfill({ status: 409, json: { error: "revision_conflict" } });
        const version = (record.workflow_version || 0) + 1;
        mock.profiles[match[1]] = {
          ...record,
          revision: record.revision + 1,
          workflow_version: version,
          draft_version: version,
          enabled: true,
          routable: true,
          published: { ...record.draft, workflow_version: version },
        };
      }
      return route.fulfill({ json: mock.profiles[match[1]] });
    }
    return route.fulfill({ json: { items: [] } });
  });
  return mock;
}

// The switch of an AppToggle is named after its setting.
export const toggle = (page: Page, name: string) =>
  page.getByRole("checkbox", { name, exact: true });
export async function flip(page: Page, name: string) {
  await toggle(page, name).locator("..").click();
}
export async function choose(page: Page, label: string, option: string | RegExp) {
  const field = page.getByRole("combobox", { name: label, exact: true });
  await field.click();
  await field.fill("");
  await page.getByRole("option", { name: option, exact: typeof option === "string" }).click();
  // The combobox takes the focus back a moment after the choice: wait for
  // it, so that the next fill does not type into the combobox.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("combobox");
}
export const drawer = (page: Page) =>
  page.getByRole("dialog").filter({ hasText: "Create agent" });
