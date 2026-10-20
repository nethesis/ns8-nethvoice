import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const base = new URL("../../../var/www/html/freepbx/rest/lib/agents/contracts/", import.meta.url);
const tools = JSON.parse(readFileSync(new URL("tools-v3.json", base), "utf8"));
tools[0].editor = {automatic:true};
tools[1].editor = {descriptions_field:"descriptions",categories:[
  {enabled_field:"extensions_enabled",destinations_field:"extension_allowlist",inventory:"extensions",selection:"allowlist"},
  {enabled_field:"queues_enabled",destinations_field:"queue_denylist",inventory:"queues",selection:"denylist"},
]};
const old = JSON.parse(readFileSync(new URL("tools-v2.json", base), "utf8"));
const defaults = JSON.parse(readFileSync(new URL("published-v6.example.json", base), "utf8"));
for (const key of ["agent_id", "destination_id", "workflow_version", "provider"]) delete defaults[key];
defaults.tool_bindings[0].enabled = true;
defaults.tool_bindings[1].config.ivrs_enabled = false;
const catalog = { tools: [...old, ...tools], draft_defaults: defaults, extensions: [], providers: ["openai", "grok"], default_language: "en", languages: [{ id: "en", label: "English" }] };
async function login(page: Page) {
  page.on("pageerror",e=>{throw e;});
  await page.addInitScript(() => {
    localStorage.setItem("secretkey", JSON.stringify({ user: "administrator", hash: "synthetic" }));
    localStorage.setItem("nethvoice.agents.language", "en");
  });
}
const toggle=(page:Page,name:string)=>page.getByRole("checkbox",{name,exact:true});
const row=(page:Page,name:string)=>toggle(page,name).locator("xpath=ancestor::div[contains(@class,'space-y-2')][1]");

test("routing editor uses positive grants, inline descriptions, collapsed categories and publication lifecycle", async ({ page }) => {
  await login(page);
  let agent = {agent_id:"receptionist", name:"Receptionist", kind:"builtin", enabled:true, revision:7, draft_version:4,workflow_version:4,sync_status:"synced",legacy:false,draft:structuredClone(defaults),published:{...structuredClone(defaults),workflow_version:4}};
  await page.route("**/freepbx/rest/agents/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.split("/agents")[1];
    if (req.method() !== "GET") {
      expect(req.headers()["x-agents-csrf"]).toBe("synthetic-csrf");
      const body=req.postDataJSON(); expect(body.expected_revision).toBe(agent.revision);
      if(req.method()==="PUT") agent={...agent,revision:agent.revision+1,draft_version:5,draft:body.profile.draft};
      else if(path.endsWith("/publish")) agent={...agent,revision:agent.revision+1,workflow_version:5,published:{...agent.draft,workflow_version:5}};
      else throw new Error("Unexpected mutation " + path);
      await route.fulfill({json:agent});return;
    }
    if(path==="/destinations") {
      const type=url.searchParams.get("type"), query=url.searchParams.get("query") || "";
      const items=[{id:"extension:203",type:"extension",name:"Alice",available:true,permitted:false}, {id:"queue:600",type:"queue",name:"Customer Support",available:true,permitted:false},{id:"ivr:7",type:"ivr",name:"Main menu",available:true,permitted:false}].filter(row=>(!type||row.type===type)&&row.name.toLowerCase().includes(query.toLowerCase()));
      await route.fulfill({json:{items,next_offset:null,total:items.length,modules:{extension:true,queue:true,ivr:true},unavailable_ids:[]}});return;
    }
    await route.fulfill({json:path==="/access"?{csrf:"synthetic-csrf"}:path==="/catalog"?catalog:path==="/trunks"?{items:[]}:agent});
  });
  await page.goto("./#/agents/receptionist");
  await expect(page.getByRole("button",{name:"Save draft",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Publish",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Upgrade routing draft",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Manage provider trunks →",exact:true})).toHaveCount(0);
  await expect(page.locator("aside a")).toHaveText(["Provider trunks", "Agents", "Activity"]);
  await expect(toggle(page,"Find permitted PBX destinations")).toHaveCount(0);
  await expect(toggle(page,"Queues")).toHaveCount(0);
  await toggle(page,"Transfer to a permitted PBX destination").locator("..").click();
  await expect(toggle(page,"Direct extensions")).not.toBeChecked();
  await expect(page.getByLabel("Search extensions by name, number or purpose",{exact:true})).toHaveCount(0);
  await expect(toggle(page,"Queues")).toBeChecked();
  await expect(toggle(page,"Customer Support (600)")).toBeChecked();
  await expect(toggle(page,"IVRs")).toHaveCount(0);
  await expect(toggle(page,"Main menu")).toHaveCount(0);
  await expect(page.getByText("Excluded queues",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Configured routing descriptions",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Previous",exact:true})).toHaveCount(0);
  await row(page,"Customer Support (600)").getByLabel("Additional description (optional)").fill("Technical support team");
  await toggle(page,"Customer Support (600)").locator("..").click();
  await expect(row(page,"Customer Support (600)").getByLabel("Additional description (optional)")).toHaveCount(0);
  await toggle(page,"Customer Support (600)").locator("..").click();
  await expect(row(page,"Customer Support (600)").getByLabel("Additional description (optional)")).toHaveValue("Technical support team");
  await toggle(page,"Queues").locator("..").click();
  await expect(toggle(page,"Customer Support (600)")).toHaveCount(0);
  await toggle(page,"Direct extensions").locator("..").click();
  await expect(toggle(page,"Alice (203)")).not.toBeChecked();
  await expect(row(page,"Alice (203)").getByLabel("Additional description (optional)")).toHaveCount(0);
  await toggle(page,"Alice (203)").locator("..").click();
  await row(page,"Alice (203)").getByLabel("Additional description (optional)").fill("He is a very cool guy");

  await expect(page.getByRole("button",{name:"Publish",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect(page.getByRole("button",{name:"Save draft",exact:true})).toBeDisabled();
  const publish=page.getByRole("button",{name:"Publish",exact:true});
  await expect(publish).toBeEnabled();
  await expect(page.getByText("Published version: 4",{exact:false})).toBeVisible();
  await expect(page.getByText("Saved draft version: 5",{exact:false})).toBeVisible();
  expect(agent.workflow_version).toBe(4);
  expect(agent.draft.tool_bindings[0].enabled).toBe(true);
  const config=agent.draft.tool_bindings[1].config;
  expect(config.ivrs_enabled).toBe(false);
  expect(config.extension_allowlist).toEqual(["extension:203"]);expect(config.queue_denylist).toEqual([]);expect(config.queues_enabled).toBe(false);
  expect(config.descriptions).toEqual([{destination_id:"queue:600",description:"Technical support team"},{destination_id:"extension:203",description:"He is a very cool guy"}]);
  await page.screenshot({path:"/tmp/voice-agent-routing-editor.png",fullPage:true});
  await publish.click();
  await expect(page.getByText("Published version: 5",{exact:false})).toBeVisible();
  await expect(publish).toBeDisabled();
  await page.getByLabel("Name",{exact:true}).fill("Receptionist changed");
  await expect(publish).toBeDisabled();
  await page.getByLabel("Name",{exact:true}).fill("Receptionist");
  await expect(publish).toBeDisabled();
  await expect(page.getByRole("button",{name:"Enable agent",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Disable agent",exact:true})).toHaveCount(0);
  await page.getByLabel("Search extensions by name, number or purpose",{exact:true}).fill("Nobody");
  await expect(toggle(page,"Alice (203)")).toHaveCount(0);
  await page.getByLabel("Search extensions by name, number or purpose",{exact:true}).fill("");
  await expect(toggle(page,"Alice (203)")).toBeChecked();
});

test("routing pagination retains grants across pages and marks unavailable targets", async ({ page }) => {
  await login(page);
  const draft=structuredClone(defaults);draft.tool_bindings[1].enabled=true;
  Object.assign(draft.tool_bindings[1].config,{extensions_enabled:true,extension_allowlist:["extension:999"],queues_enabled:false,ivrs_enabled:false});
  await page.route("**/freepbx/rest/agents/**",async route=>{
    const url=new URL(route.request().url()),path=url.pathname.split("/agents")[1];
    if(path==="/destinations") {
      const offset=Number(url.searchParams.get("offset")),items=Array.from({length:21},(_,i)=>({id:"extension:"+(201+i),name:"Person "+i,type:"extension",available:true})).slice(offset,offset+20);
      await route.fulfill({json:{items,total:21,next_offset:offset===0?20:null,modules:{extension:true},unavailable_ids:["extension:999"]}});return;
    }
    await route.fulfill({json:path==="/access"?{csrf:"synthetic-csrf"}:path==="/catalog"?catalog:path==="/trunks"?{items:[]}:{agent_id:"test",name:"Test",kind:"custom",revision:1,draft_version:1,workflow_version:null,sync_status:"synced",draft,published:null}});
  });
  await page.goto("./#/agents/test");
  await expect(page.getByText("999 · Destination unavailable")).toBeVisible();
  await toggle(page,"Person 0 (201)").locator("..").click();
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await expect(toggle(page,"Person 20 (221)")).toBeVisible();
  await toggle(page,"Person 20 (221)").locator("..").click();
  await page.getByRole("button",{name:"Previous",exact:true}).click();
  await expect(toggle(page,"Person 0 (201)")).toBeChecked();
});
