import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic-test" }));
    localStorage.setItem("nethvoice.agents.language", "en");
  });
}
const draft = {provider_binding_id:"trunk_test",conversation:{language:"en",voice:"ash",greeting:"Hello",instructions:"Synthetic test instructions"},enabled_tools:[],approved_destination_ids:[],fallback_destination_id:"extension:203",max_call_duration_seconds:600};
const catalog = {tools:[{id:"directory.find_destinations",name:"Find approved extensions"},{id:"telephony.transfer",name:"Transfer to an approved extension"}],extensions:[{id:"extension:203",name:"Test extension"}],providers:["openai","grok"],default_language:"it",languages:[{id:"it",label:"Italiano (it)"},{id:"en",label:"English (en)"},{id:"es",label:"Español (es)"}],provider_credentials:{openai:{environment_available:true},grok:{environment_available:false}}};
const trunks = [{binding_id:"trunk_test",name:"Test provider",provider:"openai",revision:1,sync_status:"synced",openai_project_id:"proj_test",api_key_configured:true,webhook_secret_configured:true}];

test("built-in agents render with v0.1 navigation and independent tool editing", async ({ page }) => {
  await login(page);
  let internal = {agent_id:"internal",name:"Internal",kind:"builtin",destination_id:"agent:internal",enabled:false,revision:1,workflow_version:null as number|null,sync_status:"pending",routable:false,draft:structuredClone(draft),published:null as unknown};
  const external = {...internal,agent_id:"external",name:"External",destination_id:"agent:external",draft:structuredClone(draft)};
  const mutations: string[] = [];
  await page.route("**/freepbx/rest/agents/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace("/freepbx/rest/agents","");
    const method = route.request().method();
    expect(route.request().headers()["user"]).toBe("administrator");
    if (method !== "GET") {
      expect(route.request().headers()["x-agents-csrf"]).toBe("synthetic-csrf");
      mutations.push(path);
      const input = route.request().postDataJSON();
      expect(input.expected_revision).toBe(internal.revision);
      if(method === "PUT") internal={...internal,name:input.profile.name,draft:input.profile.draft,revision:internal.revision+1};
      if(path.endsWith("/publish")) internal={...internal,workflow_version:1,published:{...internal.draft,workflow_version:1},sync_status:"synced",revision:internal.revision+1};
      if(path.endsWith("/enabled")) internal={...internal,enabled:input.enabled,routable:input.enabled,revision:internal.revision+1};
      await route.fulfill({json:internal}); return;
    }
    const json = path==="/access" ? {milestone:"v0.1-configuration",contract_version:1,capabilities:["agents","tools"],csrf:"synthetic-csrf"} : path==="/catalog" ? catalog : path==="/trunks" ? {items:trunks} : path.endsWith("/voices") ? {items:[{id:"ash",label:"ash"},{id:"ballad",label:"ballad"},{id:"coral",label:"coral"}]} : path==="/profiles" ? {items:[internal,external]} : internal;
    await route.fulfill({json});
  });
  await page.goto("./#/agents");
  for (const name of ["Dashboard","Extensions and devices","Routes / VisualPlan"]) await expect(page.getByRole("link",{name,exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Internal",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"External",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"New agent",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Data sources",exact:true})).toHaveCount(0);
  await page.getByRole("link",{name:"Internal",exact:true}).click();
  await expect(page.getByLabel("Name",{exact:true})).toHaveValue("Internal");
  await page.getByLabel("Name",{exact:true}).fill("Internal test agent");
  await page.getByRole("checkbox",{name:"Find approved extensions",exact:true}).locator("..").click();
  await page.getByRole("checkbox",{name:"Transfer to an approved extension",exact:true}).locator("..").click();
  await page.getByRole("checkbox",{name:"Test extension (203)",exact:true}).locator("..").click();
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect(page.getByRole("button",{name:"Publish",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Publish",exact:true}).click();
  await expect(page.getByText("Published version: 1",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Enable agent",exact:true}).click();
  await expect(page.getByRole("button",{name:"Disable agent",exact:true})).toBeVisible();
  expect(mutations).toEqual(["/profiles/internal","/profiles/internal/publish","/profiles/internal/enabled"]);
  expect(internal.draft.enabled_tools).toEqual(["directory.find_destinations","telephony.transfer"]);
  expect(external.draft.enabled_tools).toEqual([]);
  await page.reload();
  await expect(page.getByRole("checkbox",{name:"Transfer to an approved extension",exact:true})).toBeChecked();
  await page.screenshot({path:"/tmp/voice-agent-v01-editor.png",fullPage:true});
});

test("provider credentials are write-only and cleared after saving", async ({page}) => {
  await login(page);
  let saved = false;
  await page.route("**/freepbx/rest/agents/**", async route => {
    const path=new URL(route.request().url()).pathname;
    if(route.request().method()==="POST") {
      const input=route.request().postDataJSON();
      expect(input.trunk.api_key).toBe("synthetic-provider-key");
      expect(input.trunk.webhook_secret).toBe("whsec_c3ludGhldGljLXNpZ25pbmctc2VjcmV0");
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
    if(route.request().method()!=="GET") {
      const input=route.request().postDataJSON();
      if(conflict) { await route.fulfill({status:409,json:{error:"revision_conflict"}}); return; }
      expect(input.expected_revision).toBe(0);
      profile={...profile,name:input.profile.name,draft:input.profile.draft};
      await route.fulfill({json:profile}); return;
    }
    const run={run_id:runId,agent_id:"agent_test",agent_name:"Basic test",workflow_version:1,started_at:"2026-01-01 10:00:00",ended_at:"2026-01-01 10:01:00",outcome:"transferred",error_code:null};
    const json=path==="/access"?{csrf:"synthetic-csrf"}:path==="/catalog"?catalog:path==="/trunks"?{items:trunks}:path.endsWith("/voices")?{items:[{id:"ash",label:"ash"},{id:"ballad",label:"ballad"},{id:"coral",label:"coral"}]}:path==="/profiles"?{items:[profile]}:path==="/runs"?{items:[run],has_more:false,page:1}:path.startsWith("/runs/")?{...run,events:[{event_id:runId,event_type:"transfer_committed",occurred_at:run.ended_at,error_code:null,tool_id:"telephony.transfer",destination_id:"extension:203"}]}:profile;
    await route.fulfill({json});
  });
  await page.goto("./#/agents/new");
  await expect(page.getByRole("button",{name:/^Default language/})).toContainText("Italiano (it)");
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
});
