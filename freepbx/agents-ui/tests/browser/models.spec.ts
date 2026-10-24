import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const capabilities=JSON.parse(readFileSync(new URL('../../../var/www/html/freepbx/rest/lib/agents/contracts/provider-models-v2.json',import.meta.url),'utf8'));
const tools=JSON.parse(readFileSync(new URL('../../../var/www/html/freepbx/rest/lib/agents/contracts/tools-v5.json',import.meta.url),'utf8'));
const live={items:capabilities.openai.models,backend_models:capabilities.openai.backend_models,default_model:capabilities.openai.default,source:'provider_api',selection:'selectable'};
const managed={items:capabilities.grok.models,backend_models:[],default_model:'provider-default',source:'provider_managed',selection:'provider_managed'};
const trunks=[{binding_id:'trunk_test',provider:'openai',name:'Shared OpenAI',revision:1,sync_status:'synced',openai_project_id:'proj_test',api_key_configured:true,webhook_secret_configured:true},{binding_id:'trunk_grok',provider:'grok',name:'Grok test',revision:1,sync_status:'synced',api_key_configured:true,webhook_secret_configured:true}];
function agent(id='receptionist') {return {agent_id:id,name:id==='receptionist'?'Receptionist':'Second agent',kind:id==='receptionist'?'builtin':'custom',destination_id:'agent:'+id,enabled:false,revision:1,workflow_version:null as number|null,sync_status:'synced',routable:false,published:null as unknown,draft:{contract_version:8,provider_binding_id:'trunk_test',conversation:{language:'en',voice:'marin',greeting:'Hello',instructions:'Speak briefly.',model:'gpt-realtime-2.1',options:null as Record<string,string|number>|null},tool_bindings:tools.map((t:any)=>({tool_id:t.id,tool_version:t.version,enabled:false,config:t.defaults})),fallback_destination_id:'hangup',max_call_duration_seconds:600,debug:{transcription_enabled:false,retention_hours:24}}};}
async function setup(page:Page,discovery?: (input:any,route:any)=>Promise<void>) {
  page.on('pageerror',error=>{throw error;});
  await page.addInitScript(()=>{localStorage.setItem('secretkey',JSON.stringify({user:'administrator',hash:'synthetic'}));localStorage.setItem('nethvoice.agents.language','en');});
  const profiles:Record<string,ReturnType<typeof agent>>={receptionist:agent(),second:agent('second')};
  await page.route('**/freepbx/rest/agents/**',async route=>{
    const path=new URL(route.request().url()).pathname.replace('/freepbx/rest/agents','');
    if(path==='/trunks/models') {
      const input=route.request().postDataJSON();expect(input).not.toHaveProperty('api_key');
      expect(route.request().headers()['x-agents-csrf']).toBe('synthetic-csrf');
      if(discovery) await discovery(input,route);
      else await route.fulfill({json:input.provider==='grok'?managed:live});
      return;
    }
    if(path.startsWith('/profiles/')) {
      const id=path.split('/')[2];let value=profiles[id];
      if(route.request().method()==='PUT') {const input=route.request().postDataJSON();expect(input.expected_revision).toBe(value.revision);value=profiles[id]={...value,draft:input.profile.draft,revision:value.revision+1};}
      else if(path.endsWith('/publish')) {value=profiles[id]={...value,published:{...value.draft,contract_version:8,workflow_version:1},workflow_version:1,revision:value.revision+1};}
      await route.fulfill({json:value});return;
    }
    await route.fulfill({json:path==='/access'?{csrf:'synthetic-csrf'}:path==='/catalog'?{tools,extensions:[],default_language:'en',languages:[{id:'en',label:'English'}]}:path==='/trunks'?{items:trunks}:path.endsWith('/voices')?{items:[{id:'ara',label:'Ara'}]}:{items:Object.values(profiles)}});
  });
  return profiles;
}
async function choose(page:Page,label:string,option:string) {await page.getByRole('button',{name:new RegExp('^'+label)}).click();await page.getByRole('option',{name:option,exact:true}).click();}

test('agent owns model, Live voice and advanced settings across save/reload/publication',async({page})=>{
  const profiles=await setup(page);
  await page.goto('./#/agents/receptionist');
  await choose(page,'Conversation voice model','GPT Live 1 (gpt-live-1)');
  await expect(page.getByText(/GPT-Live is experimental/)).toBeVisible();
  await choose(page,'Voice','Quartz');
  await choose(page,'GPT-Live companion model','GPT-6 Sol');
  await choose(page,'Backend reasoning effort','high');
  await choose(page,'Backend response detail','medium');
  await choose(page,'Backend service tier','priority');
  await page.getByLabel('Maximum backend output tokens',{exact:true}).fill('4096');
  await page.getByLabel('Backend-task instructions',{exact:true}).fill('Use only approved routing tools.');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  expect(profiles.receptionist.draft.conversation).toMatchObject({model:'gpt-live-1',voice:'quartz',options:{backend_model:'gpt-6-sol',reasoning_effort:'high',verbosity:'medium',service_tier:'priority',max_output_tokens:4096}});
  expect(profiles.second.draft.conversation.model).toBe('gpt-realtime-2.1');
  await page.reload();
  await expect(page.getByRole('button',{name:/^Conversation voice model/})).toContainText('gpt-live-1');
  await expect(page.getByLabel('Maximum backend output tokens',{exact:true})).toHaveValue('4096');
  await page.getByRole('button',{name:'Publish',exact:true}).click();
  expect(profiles.receptionist.published).toMatchObject({contract_version:8,conversation:{model:'gpt-live-1',voice:'quartz'}});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'/tmp/voice-agent-v5-live-options-mobile.png',fullPage:true});
});

test('agent discovery keeps saved selections through empty, error and catalog fallback',async({page})=>{
  let mode='empty';
  await setup(page,async(_,route)=>{
    if(mode==='error') await route.fulfill({status:422,json:{error:'provider_credentials_rejected'}});
    else await route.fulfill({json:mode==='fallback'?{...live,source:'adapter_catalog',discovery_error:'provider_catalog_unavailable'}:{...live,items:[]}});
  });
  await page.goto('./#/agents/receptionist');
  await expect(page.getByText(/No compatible conversation models/)).toBeVisible();
  await expect(page.getByText('The saved model is unavailable. It has been kept; choose another model explicitly to change it.',{exact:true})).toBeVisible();
  mode='error';await page.getByRole('button',{name:'Refresh models',exact:true}).click();
  await expect(page.getByText('Model discovery failed. Check the API credentials and refresh the list.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Conversation voice model/})).toContainText('gpt-realtime-2.1');
  mode='fallback';await page.getByRole('button',{name:'Refresh models',exact:true}).click();
  await expect(page.getByText(/Provider discovery is unavailable/)).toBeVisible();
  await expect(page.getByRole('button',{name:/^Voice/})).toContainText('Marin');
});

test('late OpenAI discovery cannot overwrite another trunk or its provider-managed policy',async({page})=>{
  let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  await setup(page,async(input,route)=>{if(input.provider==='openai'){await pending;await route.fulfill({json:live});}else await route.fulfill({json:managed});});
  await page.goto('./#/agents/receptionist');
  await expect(page.getByText('Loading compatible models…',{exact:true})).toBeVisible();
  await choose(page,'Provider trunk','Grok test (grok)');
  await expect(page.getByRole('button',{name:/^Conversation voice model/})).toContainText('Grok SIP');
  await expect(page.getByRole('button',{name:/^Conversation voice model/})).toBeDisabled();
  release();
  await expect(page.getByText(/Grok chooses the model/)).toBeVisible();
  await expect(page.getByRole('button',{name:/^Conversation voice model/})).toContainText('Grok SIP');
  await expect(page.getByRole('button',{name:/^Voice/})).not.toContainText('Marin');
});

test('changing model drops incompatible voice and options; trunk editor has no model control',async({page})=>{
  await setup(page);await page.goto('./#/agents/receptionist');
  await choose(page,'Conversation voice model','GPT Live 1 (gpt-live-1)');
  await choose(page,'Voice','Quartz');
  await choose(page,'Conversation voice model','GPT Realtime 2 (gpt-realtime-2)');
  await expect(page.getByRole('button',{name:/^Voice/})).not.toContainText('Quartz');
  await expect(page.getByLabel('Backend-task instructions',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByRole('button',{name:'Publish',exact:true})).toBeEnabled();
  await page.goto('./#/trunks');
  await page.getByRole('button',{name:'Edit',exact:true}).first().click();
  await expect(page.getByRole('button',{name:/^Conversation voice model/})).toHaveCount(0);
});

test('each selected model displays exactly its own supported voice list',async({page})=>{
  await setup(page);await page.goto('./#/agents/receptionist');
  for(const model of capabilities.openai.models) {
    if(model.id!=='gpt-realtime-2.1') await choose(page,'Conversation voice model',`${model.label} (${model.id})`);
    await page.getByRole('button',{name:/^Voice/}).click();
    const list=page.getByRole('listbox');
    await expect(list.getByRole('option')).toHaveCount(model.voices.length+1);
    for(const voice of model.voices) await expect(list.getByRole('option',{name:voice.label,exact:true})).toBeVisible();
    if(model.adapter==='realtime') await expect(list.getByRole('option',{name:'Quartz',exact:true})).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});


test('voice and companion models have separate dropdowns',async({page})=>{
  await setup(page);await page.goto('./#/agents/receptionist');
  await page.getByRole('button',{name:/^Conversation voice model/}).click();
  const list=page.getByRole('listbox');
  await expect(list.getByRole('option',{name:/GPT-6/})).toHaveCount(0);
  await list.getByRole('option',{name:'GPT Live 1 (gpt-live-1)',exact:true}).click();
  await expect(page.getByRole('button',{name:/^GPT-Live companion model/})).toContainText('GPT-6 Luna');
  await choose(page,'GPT-Live companion model','GPT-6 Sol');
  await choose(page,'Conversation voice model','GPT Realtime 2 (gpt-realtime-2)');
  await expect(page.getByRole('button',{name:/^GPT-Live companion model/})).toHaveCount(0);
});
