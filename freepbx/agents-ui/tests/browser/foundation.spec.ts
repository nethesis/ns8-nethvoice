import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ToolDefinition } from "../../src/types";
const tools: ToolDefinition[] = JSON.parse(readFileSync(new URL("../../../var/www/html/freepbx/rest/lib/agents/contracts/tools-v2.json", import.meta.url), "utf8"));
tools.find(t=>t.id==='directory.find_destinations')!.editor={automatic:true};
const modelCapabilities = JSON.parse(readFileSync(new URL("../../../var/www/html/freepbx/rest/lib/agents/contracts/provider-models-v2.json", import.meta.url), "utf8")).openai;
const modelCatalog = {items:modelCapabilities.models,backend_models:modelCapabilities.backend_models,default_model:modelCapabilities.default,source:"provider_api",selection:"selectable"};

async function login(page: Page) {
  page.on("pageerror", error => { throw error; });
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic-test" }));
    localStorage.setItem("nethvoice.agents.language", "en");
  });
}
const draft = {provider_binding_id:"trunk_test",conversation:{model:"gpt-realtime-2.1",options:null,language:"en",voice:"ash",greeting:"Hello",instructions:"Synthetic test instructions"},tool_bindings:tools.map(tool=>({tool_id:tool.id,tool_version:tool.version,enabled:false,config:structuredClone(tool.defaults)})),fallback_destination_id:"extension:203",max_call_duration_seconds:600};
const catalog = {draft_defaults:structuredClone(draft),tools,extensions:[{id:"extension:203",name:"Test extension"}],providers:["openai","grok"],default_language:"it",languages:[{id:"it",label:"Italiano (it)"},{id:"en",label:"English (en)"},{id:"es",label:"Español (es)"}],provider_credentials:{openai:{environment_available:true},grok:{environment_available:false}}};
const trunks = [{binding_id:"trunk_test",name:"Test provider",provider:"openai",revision:1,sync_status:"synced",openai_project_id:"proj_test",api_key_configured:true,webhook_secret_configured:true}];

test("built-in agents render with v0.1 navigation and independent tool editing", async ({ page }) => {
  await login(page);
  let internal = {agent_id:"receptionist",name:"Receptionist",kind:"builtin",destination_id:"agent:receptionist",enabled:false,revision:1,workflow_version:null as number|null,sync_status:"pending",routable:false,draft:structuredClone(draft),published:null as unknown};
  const external = {...internal,agent_id:"custom_test",name:"Independent custom",destination_id:"agent:custom_test",kind:"custom",draft:structuredClone(draft)};
  const mutations: string[] = [];
  await page.route("**/freepbx/rest/agents/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace("/freepbx/rest/agents","");
    const method = route.request().method();
    expect(route.request().headers()["user"]).toBe("administrator");
    if(path==="/trunks/models") { await route.fulfill({json:modelCatalog});return; }
    if (method !== "GET") {
      expect(route.request().headers()["x-agents-csrf"]).toBe("synthetic-csrf");
      mutations.push(path);
      const input = route.request().postDataJSON();
      expect(input.expected_revision).toBe(internal.revision);
      if(method === "PUT") {input.profile.draft.tool_bindings[0].enabled=true; internal={...internal,name:input.profile.name,draft:input.profile.draft,revision:internal.revision+1};}
      if(path.endsWith("/publish")) internal={...internal,workflow_version:1,enabled:true,routable:true,published:{...internal.draft,workflow_version:1},sync_status:"synced",revision:internal.revision+1};
      if(path.endsWith("/enabled")) internal={...internal,enabled:input.enabled,routable:input.enabled,revision:internal.revision+1};
      await route.fulfill({json:internal}); return;
    }
    const json = path==="/access" ? {milestone:"v0.1-configuration",contract_version:1,capabilities:["agents","tools"],csrf:"synthetic-csrf"} : path==="/catalog" ? catalog : path==="/trunks" ? {items:trunks} : path.endsWith("/voices") ? {items:[{id:"ash",label:"ash"},{id:"ballad",label:"ballad"},{id:"coral",label:"coral"}]} : path==="/profiles" ? {items:[internal,external]} : internal;
    await route.fulfill({json});
  });
  await page.goto("./#/agents");
  for (const name of ["Dashboard","Extensions and devices","Routes / VisualPlan"]) await expect(page.getByRole("link",{name,exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Receptionist",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Independent custom",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"New agent",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Data sources",exact:true})).toHaveCount(0);
  await page.getByRole("link",{name:"Receptionist",exact:true}).click();
  await expect(page.getByLabel("Name",{exact:true})).toHaveValue("Receptionist");
  await page.getByLabel("Name",{exact:true}).fill("Receptionist test agent");
  await expect(page.getByRole("checkbox",{name:"Find approved extensions",exact:true})).toHaveCount(0);
  await page.getByRole("checkbox",{name:"Transfer to an approved extension",exact:true}).locator("..").click();

  await page.getByLabel("Search extensions by name or number",{exact:true}).fill("203");
  await page.getByRole("checkbox",{name:"Test extension (203)",exact:true}).locator("..").click();
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect(page.getByRole("button",{name:"Publish",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Publish",exact:true}).click();
  await expect(page.getByText("Published version: 1",{exact:false})).toBeVisible();
  await expect(page.getByRole("button",{name:"Enable agent",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Disable agent",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Save draft",exact:true})).toBeDisabled();
  expect(mutations).toEqual(["/profiles/receptionist","/profiles/receptionist/publish"]);
  expect(internal.draft.tool_bindings.every(binding=>binding.enabled)).toBe(true);
  expect(internal.draft.tool_bindings[1].config.approved_destination_ids).toEqual(["extension:203"]);
  expect(external.draft.tool_bindings.some(binding=>binding.enabled)).toBe(false);
  await page.reload();
  await expect(page.getByRole("checkbox",{name:"Transfer to an approved extension",exact:true})).toBeChecked();
  await page.screenshot({path:"/tmp/voice-agent-v01-editor.png",fullPage:true});
});

test("provider credentials are write-only and cleared after saving", async ({page}) => {
  await login(page);
  let saved = false;
  await page.route("**/freepbx/rest/agents/**", async route => {
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/trunks/models')) {
      await route.fulfill({json:{items:[{id:'gpt-realtime-2.1',label:'GPT Realtime 2.1'}],default_model:'gpt-realtime-2.1',source:'provider_api',selection:'selectable'}}); return;
    }
    if(route.request().method()==="POST") {
      const input=route.request().postDataJSON();
      expect(input.trunk.api_key).toBe("synthetic-provider-key");
      expect(input.trunk.webhook_secret).toBe("whsec_c3ludGhldGljLXNpZ25pbmctc2VjcmV0");
      expect(input.trunk).not.toHaveProperty("model");
      saved=true; await route.fulfill({json:trunks[0]}); return;
    }
    await route.fulfill({json:path.endsWith("/access")?{csrf:"synthetic-csrf"}:{items:saved?trunks:[]}});
  });
  await page.goto("./#/trunks");
  await page.getByRole("button",{name:"New trunk",exact:true}).click();
  await page.getByLabel("Name",{exact:true}).fill("Test provider");
  await page.getByLabel("OpenAI project ID",{exact:true}).fill("proj_test");
  await page.getByLabel("Provider API key",{exact:true}).fill("synthetic-provider-key");
  await page.getByLabel("Webhook signing secret",{exact:true}).fill("whsec_c3ludGhldGljLXNpZ25pbmctc2VjcmV0");
  await page.getByRole("button",{name:"Save settings",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Test provider",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Edit",exact:true}).click();
  await expect(page.getByLabel("Provider API key",{exact:true})).toHaveValue("");
  await expect(page.getByLabel("Webhook signing secret",{exact:true})).toHaveValue("");
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain("synthetic-provider-key");
});

test("unsigned visitors use Wizard sign-in and send no API request", async ({ page }) => {
  let calls = 0;
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("nethvoice.agents.language", "en"); });
  await page.route("**/freepbx/rest/agents/**", () => { calls++; });
  await page.goto("./");
  await expect(page.getByText("Administrator login required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in through Wizard" })).toBeVisible();
  expect(calls).toBe(0);
});


test("new Basic Voice draft saves, conflicts preserve edits, and runs show bounded metadata", async ({page}) => {
  await login(page);
  let revision=1, conflict=false;
  let profile={agent_id:"agent_test",name:"Basic test",kind:"custom",destination_id:"agent:agent_test",enabled:false,revision,workflow_version:null,sync_status:"pending",routable:false,draft:structuredClone(draft),published:null};
  const runId="11111111-1111-4111-a111-111111111111";
  await page.route("**/freepbx/rest/agents/**", async route => {
    const url=new URL(route.request().url()),path=url.pathname.replace("/freepbx/rest/agents","");
    if(path==="/trunks/models") { await route.fulfill({json:modelCatalog});return; }
    if(route.request().method()!=="GET") {
      const input=route.request().postDataJSON();
      if(conflict) { await route.fulfill({status:409,json:{error:"revision_conflict"}}); return; }
      expect(input.expected_revision).toBe(0);
      profile={...profile,name:input.profile.name,draft:input.profile.draft};
      await route.fulfill({json:profile}); return;
    }
    const run={run_id:runId,agent_id:"agent_test",agent_name:"Basic test",workflow_version:1,started_at:"2026-01-01 10:00:00",ended_at:"2026-01-01 10:01:00",outcome:"transferred",error_code:null};
    const json=path==="/access"?{csrf:"synthetic-csrf"}:path==="/catalog"?catalog:path==="/trunks"?{items:trunks}:path.endsWith("/voices")?{items:[{id:"ash",label:"ash"},{id:"ballad",label:"ballad"},{id:"coral",label:"coral"}]}:path==="/profiles"?{items:[profile]}:path==="/runs"?{items:[run],has_more:false,page:1}:path.startsWith("/runs/")?{...run,transcripts:[{role:"caller",text:"<script>synthetic transcript</script>",occurred_at:run.ended_at,interrupted:false,truncated:false}],events:[{event_id:"synthetic-search",event_type:"tool_completed",occurred_at:run.ended_at,error_code:null,tool_id:"directory.find_destinations",result_count:0},{event_id:runId,event_type:"transfer_committed",occurred_at:run.ended_at,error_code:null,tool_id:"telephony.transfer",destination_id:"extension:203"}]}:profile;
    await route.fulfill({json});
  });
  await page.goto("./#/agents/new");
  await expect(page.getByRole("checkbox",{name:"Find approved extensions",exact:true})).toHaveCount(0);
  await expect(page.getByRole("checkbox",{name:"Transfer to an approved extension",exact:true})).not.toBeChecked();
  await expect(page.getByRole("button",{name:/^Default language/})).toContainText("Italiano (it)");
  await expect(page.getByRole("checkbox",{name:"Call transcription",exact:true})).not.toBeChecked();
  await page.getByRole("checkbox",{name:"Call transcription",exact:true}).locator("..").click();
  await page.getByLabel("Transcript retention (hours, 1–24)",{exact:true}).fill("2");
  await page.getByLabel("Name",{exact:true}).fill("Basic test");
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect(page).toHaveURL(/#\/agents\/agent_test$/);
  conflict=true;
  await page.getByLabel("Name",{exact:true}).fill("Unsaved conflict");
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect(page.getByRole("button",{name:"Reload saved settings",exact:true})).toBeVisible();
  await expect(page.getByLabel("Name",{exact:true})).toHaveValue("Unsaved conflict");
  await page.getByRole("button",{name:"Reload saved settings",exact:true}).click();
  await expect(page.getByLabel("Name",{exact:true})).toHaveValue("Basic test");
  await page.getByRole("button",{name:"Activity",exact:true}).click();
  await expect(page).toHaveURL(/agent_id=agent_test/);
  await page.getByRole("button",{name:"Open",exact:true}).click();
  await expect(page.getByText("Transfer to an approved extension",{exact:false})).toBeVisible();
  await expect(page.getByText("extension:203",{exact:false})).toBeVisible();
  await expect(page.getByText("Approved directory matches: 0",{exact:true})).toBeVisible();
  await expect(page.getByText("<script>synthetic transcript</script>",{exact:true})).toBeVisible();
  expect(await page.locator(".nv-panel script").count()).toBe(0);
});
