/**
 * Browser regression with local HTTP fixtures and production VisualPlan scripts.
 * Requires PHP CLI and Playwright; no live FreePBX instance is used.
 * Optional: VISUALPLAN_PLAYWRIGHT_MODULE, VISUALPLAN_CHROME_PATH,
 * VISUALPLAN_BROWSER_ARTIFACT_DIR (defaults to a directory under /tmp).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const cp = require('child_process');
const vm = require('vm');
const assert = require('assert');
const { chromium } = require(process.env.VISUALPLAN_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../htdocs');
const artifactDir = process.env.VISUALPLAN_BROWSER_ARTIFACT_DIR || path.join(os.tmpdir(), 'visualplan-agent-browser');
fs.mkdirSync(artifactDir, { recursive: true });
// Render the real page without preloading Satellite, just like a standalone
// VisualPlan request. A fake palette would miss module bootstrap regressions.
const fixtureDir=fs.mkdtempSync(path.join(os.tmpdir(),'visualplan-freepbx-'));
const fixtureConf=path.join(fixtureDir,'freepbx.conf');
fs.writeFileSync(fixtureConf,`<?php
interface BMO {}
class FreePBX_Helpers {}
class VisualplanFixtureUser { public function checkSection($section) { return $section === 'visualplan'; } }
class FreePBX {
 public static function Satellite() {
  if (!class_exists('Satellite', false)) { throw new RuntimeException('Satellite class not loaded'); }
  return new Satellite((object) array('Database' => null));
 }
}
session_save_path(__DIR__);
session_start();
$_SESSION['AMP_user'] = new VisualplanFixtureUser();
$_SESSION['satellite_agent_csrf'] = 'fixture-csrf';
`);
let html;
try {
 html=cp.execFileSync('php',[path.join(root,'index.php')],{encoding:'utf8',env:{...process.env,FREEPBX_CONF:fixtureConf}});
} finally {
 fs.rmSync(fixtureDir,{recursive:true,force:true});
}
let trunks={}, nextId=1, captures=[], saveRequests=[];
const labelContext={languages:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'i18n/en.js'),'utf8'),labelContext);
const productionImports=JSON.parse(cp.execFileSync('php',['-r', `
define('NETHVPLAN_VISUALIZE_LIBRARY_MODE',true);require $argv[1];
$langArray=json_decode($argv[2],true);$widgetTemplate=array('userData'=>array(),'entities'=>array());$connectionTemplate=array('type'=>'MyConnection');$xPos=$yPos=10;
$data=array('satellite-agent-destination'=>array(),'agent-trunks'=>array(1=>array('name'=>'Provider trunk')));
foreach(array(10=>'satellite-agent-destination-20,s,1',20=>null,40=>'satellite-agent-destination-10,s,1') as $id=>$fallback){$data['satellite-agent-destination'][$id]=array('id'=>$id,'freepbx_name'=>'CleverAI_'.$id,'cleverai_trunk_id'=>1,'cleverai_flow'=>'existing-flow','fallback_destination'=>$fallback);}
$widgets=$connections=array();nethvplan_explore($data,'satellite-agent-destination-10,s,1',array());$agent=array_merge($widgets,$connections);
$widgets=$connections=array();nethvplan_explore($data,'satellite-agent-destination-40,s,1',array());echo json_encode(array('agent'=>$agent,'parent'=>array_merge($widgets,$connections)));
`,path.join(root,'visualize.php'),JSON.stringify(labelContext.languages.en)],{encoding:'utf8'}));
const productionImport=productionImports.agent;
const parentImport=productionImports.parent;
const selectableAgents=productionImport.filter(n=>n.type==='Base').concat(parentImport.filter(n=>n.id==='satellite-agent-destination%40'));
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(u.pathname==='/visualize.php'){
  res.setHeader('Content-Type','text/plain');
  if(u.searchParams.has('getAll'))res.end(JSON.stringify(selectableAgents));
  else if(u.searchParams.has('getChild')){
   const parent=Buffer.from(u.searchParams.get('getChild'),'base64').toString();
   const imported=parent==='satellite-agent-destination%40'?parentImport:productionImport;
   res.end(JSON.stringify(parent==='satellite-agent-destination%20'?{}:Object.fromEntries(imported.filter(n=>n.id!==parent).map(n=>[n.id,n]))));
  }else res.end(JSON.stringify(trunks));return;
 }
 if(u.pathname==='/plugins.php'||u.pathname==='/create.php'){
  let body='';req.on('data',s=>body+=s);req.on('end',()=>{
   res.setHeader('Content-Type','application/json');
   const data=JSON.parse(body);
   if(u.pathname==='/plugins.php'){
    captures.push({data,csrf:req.headers['x-satellite-agent-csrf']});
    const id=nextId++;trunks[id]={id,name:data.trunk.name,provider:data.trunk.provider,runtime_owner:'cleverai',status:'Configured'};
    res.end(JSON.stringify({success:true,trunk:trunks[id]}));
   }else{
    saveRequests.push(data);let agentIds={};for(const node of data){if(node.id.startsWith('satellite-agent-destination%'))agentIds[node.id]=45;}
    res.statusCode=500;res.end(JSON.stringify({success:false,error:'Fixture save failure',agentIds}));
   }
  });return;
 }
 const file=path.resolve(root,'.'+u.pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
 const ext=path.extname(file);res.setHeader('Content-Type',ext==='.js'?'application/javascript':ext==='.css'?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 let browser;
 try {
 browser=await chromium.launch({headless:true,executablePath:process.env.VISUALPLAN_CHROME_PATH || undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>window.app&&app.view);
 await page.waitForSelector('#side-nav #satellite-agent-destination',{state:'visible'});
 assert.equal(await page.locator('#satellite-agent-destination').innerText(),'Agent');
 assert.equal(await page.evaluate(()=>window.visualplanAgentCsrfToken),'fixture-csrf');
 await page.locator('#satellite-agent-destination').dragTo(page.locator('#canvas'),{targetPosition:{x:400,y:150}});
 await page.locator('.context-menu-item').filter({hasText:'Add New'}).click();
 await page.waitForSelector('#satellite-agent-destination-flow');
 await page.waitForSelector('.agent-trunk-fields',{state:'visible'});
 await page.fill('#satellite-agent-destination-flow','sales');
 await page.fill('#agent-trunk-name','Provider trunk');
 await page.fill('#agent-trunk-project','proj_visualplan');
 await page.fill('#agent-trunk-api-key','test-private-key');
 await page.screenshot({path:path.join(artifactDir,'agent-openai.png'),fullPage:true});
 await page.click('#agent-save-trunk');
 await page.waitForFunction(()=>$('#satellite-agent-destination-trunk').val()==='1');
 assert.equal(captures[0].csrf,'fixture-csrf');
 assert.equal(captures[0].data.type,'agent-trunk');
 assert.equal(captures[0].data.trunk.api_key,'test-private-key');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.waitForFunction(()=>app.view.getFigures().getSize()===1);
 const state=await page.evaluate(()=>{const node=app.view.getFigures().get(0);return {id:node.id,data:node.getUserData(),ports:node.getPorts().getSize(),name:node.classLabel.getText()};});
 assert.equal(state.data.cleverai_trunk_id,1);
 assert.equal(state.data.cleverai_flow,'sales');
 assert(!JSON.stringify(state).includes('test-private-key'));
 await page.screenshot({path:path.join(artifactDir,'agent-block.png'),fullPage:true});
 await page.evaluate(()=>app.toolbar.saveButton.click());
 await page.waitForFunction(()=>app.view.getFigures().get(0).getUserData().id===45);
 assert(!JSON.stringify(saveRequests[0]).includes('test-private-key'));
 await page.evaluate(()=>app.toolbar.saveButton.click());
 await page.waitForTimeout(200);
 assert.equal(saveRequests.length,2);
 assert.equal(saveRequests[1][0].userData.id,45);

 // Existing trunks allow creating another Agent without requiring a new trunk.
 await page.evaluate(()=>app.view.createDialog({x:700,y:400,context:app.view,dropped:$('#satellite-agent-destination')}));
 await page.waitForSelector('#satellite-agent-destination-flow');
 await page.waitForFunction(()=>$('#satellite-agent-destination-trunk option').length===1);
 assert(!await page.locator('.agent-trunk-fields').isVisible());
 await page.fill('#satellite-agent-destination-flow','bad flow');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 assert(await page.locator('#modalCreation').isVisible());
 await page.fill('#satellite-agent-destination-flow','grok-flow');
 await page.click('#agent-add-trunk');
 assert(await page.getByRole('button',{name:'Save',exact:true}).isDisabled());
 await page.selectOption('#agent-trunk-provider','grok');
 await page.selectOption('#agent-trunk-auth-mode','digest');
 await page.fill('#agent-trunk-name','Grok trunk');
 await page.fill('#agent-trunk-phone','+390721123456');
 await page.fill('#agent-trunk-api-key','grok-private-key');
 await page.fill('#agent-trunk-username','sip-user');
 await page.fill('#agent-trunk-password','sip-private-password');
 await page.screenshot({path:path.join(artifactDir,'agent-grok.png'),fullPage:true});
 await page.click('#agent-save-trunk');
 await page.waitForFunction(()=>$('#satellite-agent-destination-trunk').val()==='2');
 assert.equal(captures[1].data.trunk.sip_auth_mode,'digest');
 assert.equal(captures[1].data.trunk.sip_auth_password,'sip-private-password');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.waitForFunction(()=>app.view.getFigures().getSize()===2);
 assert(!JSON.stringify(await page.evaluate(()=>app.view.getFigures().get(1).getUserData())).includes('grok-private-key'));
 // Canceling a nested form preserves the Agent fields and leaves the graph unchanged.
 await page.evaluate(()=>app.view.createDialog({x:700,y:400,context:app.view,dropped:$('#satellite-agent-destination')}));
 await page.waitForFunction(()=>$('#satellite-agent-destination-trunk option').length===2);
 await page.fill('#satellite-agent-destination-flow','keep-this-flow');
 await page.click('#agent-add-trunk');
 await page.click('#agent-cancel-trunk');
 assert.equal(await page.inputValue('#satellite-agent-destination-flow'),'keep-this-flow');
 assert(!await page.getByRole('button',{name:'Save',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await page.evaluate(()=>app.view.getFigures().getSize()),2);
 // Select an existing Agent using the actual PHP-produced Base shape.
 await page.evaluate(()=>{app.view.clear();app.view.createList('select',null,{x:400,y:150,context:app.view,dropped:$('#satellite-agent-destination')});});
 await page.waitForSelector('.button-elem-list[elemId="1"]');
 await page.locator('.button-elem-list[elemId="1"]').click();
 await page.waitForFunction(()=>app.view.getFigures().getSize()===1);
 assert.equal(await page.evaluate(()=>app.view.getFigures().get(0).getUserData().id),20);
 // Editing an existing Agent changes its fields while retaining its identity.
 await page.evaluate(()=>{app.view.setCurrentSelection(app.view.getFigures().get(0));app.toolbar.modifyButton.click();});
 await page.waitForSelector('#satellite-agent-destination-flow');
 await page.waitForFunction(()=>$('#satellite-agent-destination-trunk option').length===2);
 assert.equal(await page.inputValue('#satellite-agent-destination-flow'),'existing-flow');
 await page.fill('#satellite-agent-destination-flow','edited-flow');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 assert.equal(await page.evaluate(()=>app.view.getFigures().get(0).getUserData().cleverai_flow),'edited-flow');
 assert.equal(await page.evaluate(()=>app.view.getFigures().get(0).getUserData().id),20);
 // Selecting the same shared Agent again must reuse its figure.
 await page.evaluate(()=>app.view.createList('select',null,{x:400,y:150,context:app.view,dropped:$('#satellite-agent-destination')}));
 await page.waitForSelector('.button-elem-list[elemId="1"]');
 await page.locator('.button-elem-list[elemId="1"]').click();
 await page.waitForSelector('#elementList',{state:'detached'});
 assert.equal(await page.evaluate(()=>app.view.getFigures().getSize()),1);
 // Importing connections must keep untouched fallbacks intact.
 await page.evaluate(data=>{app.view.clear();new draw2d.io.json.Reader().unmarshal(app.view,data);},productionImport);
 assert.equal(await page.evaluate(()=>app.view.getFigure('satellite-agent-destination%10').getUserData().fallback_touched),false);
 // Rewiring a fallback target, deleting the target, and undo all mark intent correctly.
 const third=JSON.parse(JSON.stringify(productionImport.find(n=>n.id==='satellite-agent-destination%20')));
 third.id='satellite-agent-destination%30';third.userData.id=30;
 third.entities.forEach(e=>e.id=e.id.replace('%20','%30'));third.x=700;third.y=400;
 await page.evaluate(data=>new draw2d.io.json.Reader().unmarshal(app.view,[data]),third);
 const tracking=await page.evaluate(()=>{
  const a=app.view.getFigure('satellite-agent-destination%10'),b=app.view.getFigure('satellite-agent-destination%20'),c=app.view.getFigure('satellite-agent-destination%30');
  const connection=app.view.getLines().get(0), stack=app.view.getCommandStack();
  function reset(node){const d=node.getUserData();d.fallback_touched=false;node.setUserData(d);}
  reset(a);const reconnect=new draw2d.command.CommandReconnect(connection);reconnect.setNewPorts(connection.getSource(),c.getPort('input_'+c.id));stack.execute(reconnect);
  const rewired=a.getUserData().fallback_touched;
  reset(a);stack.undo();const undone=a.getUserData().fallback_touched;
  reset(a);stack.execute(new draw2d.command.CommandDelete(b));const deleted=a.getUserData().fallback_touched;
  stack.undo();reset(a);reset(c);
  const sourceMove=new draw2d.command.CommandReconnect(connection);sourceMove.setNewPorts(c.getPort('output_agent_fallback%30'),connection.getTarget());stack.execute(sourceMove);
  return {rewired,undone,deleted,oldSource:a.getUserData().fallback_touched,newSource:c.getUserData().fallback_touched};
 });
 assert.deepEqual(tracking,{rewired:true,undone:true,deleted:true,oldSource:true,newSource:true});
 // Replacing a stored fallback gives it a new ID. Reselecting its source or a
 // new parent must preserve that replacement and any deliberate deletion.
 await page.evaluate(data=>{app.view.clear();new draw2d.io.json.Reader().unmarshal(app.view,data);},productionImport.concat(third));
 await page.evaluate(()=>{
  const original=app.view.getLines().get(0),stack=app.view.getCommandStack();
  const source=original.getSource(),target=app.view.getFigure('satellite-agent-destination%30').getPort('input_satellite-agent-destination%30');
  stack.execute(new draw2d.command.CommandDelete(original));
  const replacement=new MyConnection();replacement.setSource(source);replacement.setTarget(target);
  stack.execute(new draw2d.command.CommandAdd(app.view,replacement,0,0));
  window.replacementFallbackId=replacement.id;
  window.sharedAgent=app.view.getFigure('satellite-agent-destination%10');
 });
 async function selectAgent(elemId){
  await page.evaluate(()=>app.view.createList('select',null,{x:400,y:150,context:app.view,dropped:$('#satellite-agent-destination')}));
  await page.locator(`.button-elem-list[elemId="${elemId}"]`).click();
  await page.waitForSelector('#elementList',{state:'detached'});
 }
 async function fallbackState(){
  return page.evaluate(()=>({
   reused:app.view.getFigure('satellite-agent-destination%10')===window.sharedAgent,
   touched:window.sharedAgent.getUserData().fallback_touched,
   edges:app.view.getLines().asArray().map(line=>({id:line.id,source:line.getSource().getRoot().id,target:line.getTarget().getRoot().id})).sort((a,b)=>a.source.localeCompare(b.source))
  }));
 }
 const replacementId=await page.evaluate(()=>window.replacementFallbackId);
 const replacementEdge={id:replacementId,source:'satellite-agent-destination%10',target:'satellite-agent-destination%30'};
 await selectAgent(0);
 assert.deepEqual(await fallbackState(),{reused:true,touched:true,edges:[replacementEdge]});
 assert.equal(await page.evaluate(()=>app.view.getFigures().getSize()),3);
 await selectAgent(2);
 const parentConnection=parentImport.find(n=>n.type==='MyConnection'&&n.source.node==='satellite-agent-destination%40');
 const parentEdge={id:parentConnection.id,source:'satellite-agent-destination%40',target:'satellite-agent-destination%10'};
 assert.deepEqual(await fallbackState(),{reused:true,touched:true,edges:[replacementEdge,parentEdge]});
 assert.equal(await page.evaluate(()=>app.view.getFigures().getSize()),4);
 await page.evaluate(()=>app.view.getCommandStack().execute(new draw2d.command.CommandDelete(app.view.getLine(window.replacementFallbackId))));
 await selectAgent(0);
 await selectAgent(2);
 assert.deepEqual(await fallbackState(),{reused:true,touched:true,edges:[parentEdge]});
 assert(!errors.length,errors.join('\n'));
 process.stdout.write('VisualPlan browser smoke passed: OpenAI/Grok trunk forms, cancellation, existing Agent selection/import, fallback rewiring/deletion/undo, secret-free graph, partial-save retry.\n');
 } finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1;});
