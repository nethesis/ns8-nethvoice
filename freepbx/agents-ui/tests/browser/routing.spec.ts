import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const base = new URL("../../../var/www/html/freepbx/rest/lib/agents/contracts/", import.meta.url);
const tools = JSON.parse(readFileSync(new URL("tools-v5.json", base), "utf8"));
delete tools[1].configuration_schema.properties.ivrs_enabled;
delete tools[1].configuration_schema.properties.ivr_denylist;
tools[0].editor = {automatic:true};
tools[1].editor = {descriptions_field:"descriptions",categories:[
  {enabled_field:"extensions_enabled",destinations_field:"extension_allowlist",inventory:"extensions",selection:"allowlist"},
  {enabled_field:"queues_enabled",destinations_field:"queue_denylist",inventory:"queues",selection:"denylist"},
]};
const defaults = JSON.parse(readFileSync(new URL("published-v8.example.json", base), "utf8"));
for (const key of ["agent_id", "destination_id", "workflow_version", "provider"]) delete defaults[key];
defaults.tool_bindings[0].enabled = true;
defaults.tool_bindings[1].enabled = false;
defaults.tool_bindings[1].config.ivrs_enabled = false;
const catalog = { tools, draft_defaults: defaults, extensions: [], providers: ["openai", "grok"], default_language: "en", languages: [{ id: "en", label: "English" }] };
async function login(page: Page) {
  page.on("pageerror",e=>{throw e;});
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic" }));
    localStorage.setItem("nethvoice.agents.language", "en");
  });
}
const toggle=(page:Page,name:string)=>page.getByRole("checkbox",{name,exact:true});
const drawer=(page:Page)=>page.getByRole("dialog").filter({hasText:"Manage destinations"});

test("routing editor uses permitted destinations, routing descriptions and publication lifecycle", async ({ page }) => {
  await login(page);
  let agent = {agent_id:"receptionist", name:"Receptionist", kind:"builtin", enabled:true, routable:true, revision:7, draft_version:4,workflow_version:4,sync_status:"synced",draft:structuredClone(defaults),published:{...structuredClone(defaults),workflow_version:4}};
  const mutations:string[]=[];
  await page.route("**/freepbx/rest/agents/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.split("/agents")[1];
    if (req.method() !== "GET") {
      expect(req.headers()["x-agents-csrf"]).toBe("synthetic-csrf");
      const body=req.postDataJSON(); expect(body.expected_revision).toBe(agent.revision);
      mutations.push(req.method()+" "+path);
      if(req.method()==="PUT") agent={...agent,revision:agent.revision+1,draft_version:agent.workflow_version+1,draft:body.profile.draft};
      else if(path.endsWith("/publish")) agent={...agent,revision:agent.revision+1,workflow_version:agent.draft_version,published:{...agent.draft,workflow_version:agent.draft_version}};
      else throw new Error("Unexpected mutation " + path);
      await route.fulfill({json:agent});return;
    }
    if(path==="/destinations") {
      const type=url.searchParams.get("type");
      const items=[{id:"extension:203",type:"extension",name:"Alice",available:true,permitted:false}, {id:"queue:600",type:"queue",name:"Customer Support",available:true,permitted:false},{id:"ivr:7",type:"ivr",name:"Main menu",available:true,permitted:false}].filter(row=>!type||row.type===type);
      await route.fulfill({json:{items,next_offset:null,total:items.length,modules:{extension:true,queue:true,ivr:true},unavailable_ids:[]}});return;
    }
    await route.fulfill({json:path==="/access"?{csrf:"synthetic-csrf"}:path==="/catalog"?catalog:path==="/trunks"?{items:[]}:agent});
  });
  await page.goto("./#/agents/receptionist");
  const save=page.getByRole("button",{name:"Save draft",exact:true});
  const publish=page.getByRole("button",{name:"Publish",exact:true});
  await expect(save).toBeDisabled();
  await expect(publish).toBeDisabled();
  await expect(page.locator("#main-sidebar a")).toHaveText(["Agents", "Monitoring", "Provider trunks"]);
  await expect(toggle(page,"Find permitted PBX destinations")).toHaveCount(0);
  await expect(page.getByText(/Main menu/)).toHaveCount(0);
  await toggle(page,"Transfer calls").locator("..").click();
  await expect(page.getByText("None permitted",{exact:true})).toHaveCount(1);
  await expect(page.getByText("Customer Support (600)",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Manage destinations",exact:true}).click();
  await expect(drawer(page).getByText("0 of 1 selected",{exact:true})).toBeVisible();
  await drawer(page).getByRole("checkbox",{name:"Alice",exact:true}).check();
  await drawer(page).getByLabel(/^Routing description/).fill("He is a very cool guy");
  await drawer(page).getByText("Queues (1)",{exact:true}).filter({visible:true}).click();
  await expect(drawer(page).getByRole("checkbox",{name:"Customer Support",exact:true})).toBeChecked();
  await expect(drawer(page).getByText(/Main menu/)).toHaveCount(0);
  await drawer(page).getByLabel(/^Routing description/).fill("Technical support team");
  await drawer(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByText("Alice (203)",{exact:true})).toBeVisible();
  await expect(publish).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
  await expect(page.getByText("Draft version 5 · Published version 4",{exact:true})).toBeVisible();
  await expect(page.getByText("Draft not published",{exact:true})).toBeVisible();
  expect(agent.workflow_version).toBe(4);
  expect(agent.draft.tool_bindings[0].enabled).toBe(true);
  const config=agent.draft.tool_bindings[1].config;
  expect(config.ivrs_enabled).toBe(false);
  expect(config.extensions_enabled).toBe(true);
  expect(config.extension_allowlist).toEqual(["extension:203"]);
  expect(config.queues_enabled).toBe(true);
  expect(config.queue_denylist).toEqual([]);
  expect(config.descriptions).toEqual([{destination_id:"extension:203",description:"He is a very cool guy"},{destination_id:"queue:600",description:"Technical support team"}]);
  await page.screenshot({path:"/tmp/voice-agent-routing-editor.png",fullPage:true});
  await publish.click();
  await expect(page.getByText("Published version 5",{exact:true})).toBeVisible();
  await expect(publish).toBeDisabled();
  await page.getByLabel("Name",{exact:true}).fill("Receptionist changed");
  await expect(publish).toBeEnabled();
  await page.getByLabel("Name",{exact:true}).fill("Receptionist");
  await expect(publish).toBeDisabled();
  await page.getByRole("button",{name:"Manage destinations",exact:true}).click();
  await drawer(page).getByText("Queues (1)",{exact:true}).filter({visible:true}).click();
  await drawer(page).getByRole("checkbox",{name:"Customer Support",exact:true}).uncheck();
  await drawer(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByText("None permitted",{exact:true})).toHaveCount(1);
  await save.click();
  await expect(save).toBeDisabled();
  expect(agent.draft.tool_bindings[1].config.queues_enabled).toBe(false);
  expect(agent.draft.tool_bindings[1].config.descriptions).toEqual([{destination_id:"extension:203",description:"He is a very cool guy"}]);
  expect(mutations).toEqual(["PUT /profiles/receptionist","POST /profiles/receptionist/publish","PUT /profiles/receptionist"]);
});

test("destinations load every inventory page and unavailable grants can be removed", async ({ page }) => {
  await login(page);
  let draft=structuredClone(defaults);draft.tool_bindings[1].enabled=true;
  Object.assign(draft.tool_bindings[1].config,{extensions_enabled:true,extension_allowlist:["extension:999"],queues_enabled:false,ivrs_enabled:false});
  const offsets:string[]=[];
  await page.route("**/freepbx/rest/agents/**",async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname.split("/agents")[1];
    if(req.method()==="PUT"){draft=req.postDataJSON().profile.draft;}
    if(path==="/destinations") {
      if(url.searchParams.get("type")==="queue"){await route.fulfill({json:{items:[],total:0,next_offset:null,modules:{queue:true},unavailable_ids:[]}});return;}
      const offset=Number(url.searchParams.get("offset")||0);offsets.push(String(offset));
      const all=Array.from({length:21},(_,i)=>({id:"extension:"+(201+i),name:"Person "+i,type:"extension",available:true}));
      const items=all.slice(offset,offset+10);
      await route.fulfill({json:{items,total:all.length,next_offset:offset+10<all.length?offset+10:null,modules:{extension:true},unavailable_ids:[]}});return;
    }
    await route.fulfill({json:path==="/access"?{csrf:"synthetic-csrf"}:path==="/catalog"?catalog:path==="/trunks"?{items:[]}:{agent_id:"test",name:"Test",kind:"custom",revision:1,draft_version:1,workflow_version:null,sync_status:"synced",draft,published:null}});
  });
  await page.goto("./#/agents/test");
  await expect(page.getByText("One destination is no longer available",{exact:true})).toBeVisible();
  await expect(page.getByText("(999)",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Manage destinations",exact:true}).click();
  expect(offsets).toEqual(["0","10","20"]);
  await expect(drawer(page).getByText("0 of 21 selected",{exact:true})).toBeVisible();
  await drawer(page).getByPlaceholder("Filter extensions").fill("Person 20");
  await drawer(page).getByRole("checkbox",{name:"Person 20",exact:true}).check();
  await drawer(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByText("One destination is no longer available",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Person 20 (221)",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect.poll(()=>draft.tool_bindings[1].config.extension_allowlist).toEqual(["extension:221"]);
});
