import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const base = new URL("../../../var/www/html/freepbx/rest/lib/agents/contracts/", import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, base), "utf8"));
const tools = [...read("tools-v5.json"), ...read("tools-v6.json").filter((t: {id: string; version: number}) => t.id === "pbx.transfer" && t.version === 3)];
function draft() {
  const value = read("published-v8.example.json");
  for (const key of ["agent_id", "destination_id", "workflow_version", "provider"]) delete value[key];
  value.provider_binding_id = null;
  for (const binding of value.tool_bindings) binding.enabled = false;
  return value;
}
for (const language of ["en", "it"]) {
  test(`attended transfer is explicitly enabled and saved per agent (${language})`, async ({page}) => {
    const record = {agent_id: "receptionist", name: "Receptionist", agent_type: "basic_voice", kind: "builtin", revision: 1, published: null, draft: draft()};
    const original = structuredClone(record.draft);
    let writes = 0;
    await page.addInitScript((language) => {
      localStorage.setItem("secretkey", JSON.stringify({user: "administrator", hash: "synthetic"}));
      localStorage.setItem("nethvoice.agents.language", language);
    }, language);
    await page.route("**/freepbx/rest/agents/**", async route => {
      const path = new URL(route.request().url()).pathname.split("/agents")[1];
      if (route.request().method() === "PUT") {record.draft = route.request().postDataJSON().profile.draft; record.revision++; writes++;}
      await route.fulfill({json: path === "/access" ? {csrf:"synthetic-csrf"} : path === "/catalog" ? {tools, draft_defaults:draft(), default_language:language, extensions:[], languages:[{id:language,label:language}], consultation_assistants:[{agent_id:"internal",name:"Private assistant"}]} : path === "/trunks" ? {items:[]} : path === "/destinations" ? {items:[],next_offset:null,modules:{},unavailable_ids:[]} : record});
    });
    await page.goto("./#/agents/receptionist");
    const mode = page.getByRole("button",{name:language === "en" ? /^Transfer to people/ : /^Trasferimento alle persone/});
    await expect(mode).toBeVisible();
    expect(writes).toBe(0); expect(record.draft).toEqual(original);
    await mode.click();
    await page.getByRole("option",{name:language === "en" ? "Attended transfer" : "Trasferimento con consultazione",exact:true}).click();
    const assistant = page.getByRole("button",{name:language === "en" ? /^Internal consultation assistant/ : /^Assistente interno per le consultazioni/});
    await assistant.click(); await page.getByRole("option",{name:"Private assistant",exact:true}).click();
    await page.getByRole("button",{name:language === "en" ? "Save draft" : "Salva bozza",exact:true}).click();
    await expect.poll(()=>writes).toBe(1);
    expect(record.draft).toMatchObject({contract_version:9,role:"public",consultation:{mode:"attended",phone:true,chat:false,assistant_id:"internal"}});
    expect(record.draft.tool_bindings[1].config).toEqual(original.tool_bindings[1].config);
    expect(record.draft.tool_bindings[1].tool_version).toBe(3);
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test("internal assistant has its own configuration and no public PBX tools", async ({page}) => {
  const internal = draft();
  Object.assign(internal,{contract_version:9,role:"consultation",chat_model:null,consultation:{mode:"direct",phone:false,chat:false,assistant_id:null},fallback_destination_id:"hangup"});
  for (const binding of internal.tool_bindings) {binding.enabled=false;if(binding.tool_id==="pbx.transfer") binding.tool_version=3;}
  let saved: any;
  await page.addInitScript(() => {localStorage.setItem("secretkey",JSON.stringify({user:"administrator",hash:"synthetic"}));localStorage.setItem("nethvoice.agents.language","en");});
  await page.route("**/freepbx/rest/agents/**",async route => {
    const path=new URL(route.request().url()).pathname.split("/agents")[1];
    if (route.request().method()==="POST") {saved=route.request().postDataJSON().profile;await route.fulfill({json:{...saved,agent_id:"internal",revision:1,kind:"custom",agent_type:"consultation",published:null}});return;}
    await route.fulfill({json:path==="/access"?{csrf:"synthetic-csrf"}:path==="/catalog"?{tools,draft_defaults:draft(),consultation_defaults:internal,default_language:"en",languages:[{id:"en",label:"English"}],extensions:[],consultation_assistants:[]}:path==="/trunks"?{items:[]}:{...saved,agent_id:"internal",revision:1,kind:"custom",agent_type:"consultation",published:null}});
  });
  await page.goto("./#/agents/new");
  await page.getByRole("button",{name:/^Agent type/}).click();
  await page.getByRole("option",{name:"Internal consultation assistant",exact:true}).click();
  await expect(page.getByText(/This assistant handles private colleague consultations only/)).toBeVisible();
  await expect(page.getByRole("checkbox",{name:"Transfer to a permitted PBX destination",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/^Transfer to people/})).toHaveCount(0);
  await page.getByLabel("Name",{exact:true}).fill("Private assistant");
  await page.getByLabel("Chat model ID (optional)",{exact:true}).fill("synthetic-text-model");
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect.poll(()=>saved?.draft?.chat_model).toBe("synthetic-text-model");
  expect(saved.draft.role).toBe("consultation");
  expect(saved.draft.tool_bindings.every((binding: {enabled:boolean})=>!binding.enabled)).toBe(true);
});
