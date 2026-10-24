import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const native = resolve(process.cwd(), '../var/www/html/freepbx/admin/modules/visualplan/htdocs');

test('native Agent picker uses saved built-ins, rejects drafts, adds with undo and opens editors', async ({page}) => {
  await page.goto('./');
  await page.setContent('<div id="canvas" style="width:1000px;height:700px"></div>');
  await page.addScriptTag({content:'var example={}, languages={}, browserLang="en", app={}; window.visualplanAgentCsrf="synthetic-csrf"; window.opened=[]; window.open=function(url){window.opened.push(url);};'});
  for (const script of ['lib/shifty.js','lib/raphael.js','lib/jquery-1.10.2.min.js','lib/jquery-ui-1.8.23.custom.min.js','lib/jquery.browser.js','lib/Class.js','lib/json2.js','lib/pathfinding-browser.min.js','lib/draw2d.js','i18n/en.js','app/View.js','app/Toolbar.js','app/widgets/Base.js','app/Agents.js']) {
    await page.addScriptTag({path:resolve(native,script)});
  }
  const widget=(id:string,ready:boolean)=>({type:'Base',id:'satellite-agent-destination%'+id,name:'Agent',x:0,y:0,radius:20,bgColor:'#7c3aed',userData:{agent_id:id,system_managed:true,routable:ready,kind:'builtin'},entities:[{text:id==='internal'?'Internal':'External',id:'satellite-agent-destination%'+id,type:'input'},{text:'Fallback',id:'agent_fallback%'+id,type:'output'},{text:'Configure',id,type:'text',cssClass:'link'}]});
  let requests=0;
  await page.route('**/visualize.php?readData=voice-agents',async route=>{requests++;await route.fulfill({json:{internal:widget('internal',false),external:widget('external',true)}});});
  await page.evaluate('app.view=new example.View("canvas"); app.view.onDrop($(document.createElement("div")).attr("id","satellite-agent-destination"),80,80);');
  await expect(page.locator('#agentSelect option')).toHaveCount(2);
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Configure, publish and enable this agent before adding it.');
  await page.getByRole('button',{name:'New agent',exact:true}).click();
  expect(await page.evaluate('window.opened')).toContain('/freepbx/agents-ui/#/agents/new');
  await page.locator('#agentSelect').selectOption('external');
  await expect(page.getByRole('link',{name:'Configure agent',exact:true})).toHaveAttribute('href','/freepbx/agents-ui/#/agents/external');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  expect(await page.evaluate('app.view.getFigures().getSize()')).toBe(1);
  expect(await page.evaluate('app.view.getFigure("satellite-agent-destination%external").getEntity(0).getInputPorts().getSize()')).toBe(1);
  expect(await page.evaluate('app.view.getFigure("satellite-agent-destination%external").getEntity(1).getOutputPorts().getSize()')).toBe(1);
  const target = await page.evaluate('var source=new draw2d.shape.basic.Rectangle(); source.setId("incoming%test"); app.view.add(source,0,0); var connection=new MyConnection(); connection.setSource(source.createPort("output")); connection.setTarget(app.view.getFigure("satellite-agent-destination%external").getEntity(0).getInputPort(0)); var target=connection.getPersistentAttributes().target; app.view.remove(source); target;');
  expect(target).toMatchObject({node:'satellite-agent-destination%external',port:'input_satellite-agent-destination%external'});
  await page.evaluate('example.Toolbar.prototype.createDialog({},app.view.getFigure("satellite-agent-destination%external")); app.view.getCommandStack().undo();');
  expect(await page.evaluate('window.opened')).toContain('/freepbx/agents-ui/#/agents/external');
  expect(await page.evaluate('app.view.getFigures().getSize()')).toBe(0);
  expect(requests).toBe(1);
});


test('actual Agent palette has a visible tile and icon in expanded and collapsed menus', async ({page}) => {
  await page.goto('./');
  const index=readFileSync(resolve(native,'index.php'),'utf8');
  const body=index.match(/<body[^>]*>([\s\S]*?)<\/body>/)![1];
  await page.setContent(body);
  await page.addStyleTag({path:resolve(native,'assets/css/application.css')});
  await page.addScriptTag({content:'var example={}, languages={}, browserLang="en", app={};'});
  for (const script of ['lib/shifty.js','lib/raphael.js','lib/jquery-1.10.2.min.js','lib/jquery-ui-1.8.23.custom.min.js','lib/jquery.browser.js','lib/Class.js','lib/json2.js','lib/pathfinding-browser.min.js','lib/draw2d.js','i18n/en.js','app/View.js','app/Toolbar.js']) {
    await page.addScriptTag({path:resolve(native,script)});
  }
  await page.evaluate("$('#satellite-agent-destination').text(languages.en.base_agent_string)");
  const agent=page.locator('#side-nav #satellite-agent-destination');
  await expect(agent).toBeVisible();
  await expect(agent).toHaveText('Agent');
  expect(await agent.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(82, 139, 167)');
  expect(await agent.evaluate(el=>getComputedStyle(el,'::before').content)).toBe('"\uf075"');
  await expect(agent).not.toHaveClass(/endWidget/);
  await page.evaluate('hideSidenav()');
  await expect(agent).toHaveClass(/hide_text/);
  expect(await agent.evaluate(el=>getComputedStyle(el,'::before').content)).toBe('"\uf075"');
  await expect.poll(()=>agent.evaluate(el=>el.getBoundingClientRect().width)).toBe(50);
  await page.evaluate('hideSidenav()');
  await expect(agent).not.toHaveClass(/hide_text/);
});
