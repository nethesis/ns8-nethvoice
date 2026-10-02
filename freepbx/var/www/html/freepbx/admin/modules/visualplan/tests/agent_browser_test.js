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
const index = fs.readFileSync(path.join(root,'index.php'),'utf8');
const scripts = [...index.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map(m=>`<script src="${m[1]}"></script>`).join('\n');
const styles = [...index.matchAll(/<link[^>]+href="([^"]+)"[^>]*>/g)].map(m=>`<link rel="stylesheet" href="${m[1]}">`).join('\n');
const html = `<html><head>${styles}<script>var languages={},browserLang='en'; window.visualplanAgentCsrfToken='fixture-csrf';</script>${scripts}</head><body><div id="container"><div id="toolbar"></div><div id="canvas" style="position:absolute;left:160px;top:80px;width:1100px;height:800px"></div><div id="satellite-agent-destination" data-shape="Base" style="background:#528ba7">Agent</div><div id="loader" style="display:none"></div><div id="errorer" style="display:none"><span></span><span></span></div><div id="emptier" style="display:none"><span></span></div><div id="saver" style="display:none"><span></span></div></div><script>var app = new example.Application();</script></body></html>`;
let trunks={}, nextId=1, captures=[], saveRequests=[];
const labelContext={languages:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'i18n/en.js'),'utf8'),labelContext);
const productionImport=JSON.parse(cp.execFileSync('php',['-r', `
define('NETHVPLAN_VISUALIZE_LIBRARY_MODE',true);require $argv[1];
$langArray=json_decode($argv[2],true);$widgetTemplate=array('userData'=>array(),'entities'=>array());$connectionTemplate=array('type'=>'MyConnection');$xPos=$yPos=10;
$data=array('satellite-agent-destination'=>array(),'agent-trunks'=>array(1=>array('name'=>'Provider trunk')));
foreach(array(10=>'satellite-agent-destination-20,s,1',20=>null) as $id=>$fallback){$data['satellite-agent-destination'][$id]=array('id'=>$id,'freepbx_name'=>'CleverAI_'.$id,'cleverai_trunk_id'=>1,'cleverai_flow'=>'existing-flow','fallback_destination'=>$fallback);}
$widgets=$connections=array();nethvplan_explore($data,'satellite-agent-destination-10,s,1',array());echo json_encode(array_merge($widgets,$connections));
`,path.join(root,'visualize.php'),JSON.stringify(labelContext.languages.en)],{encoding:'utf8'}));
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(u.pathname==='/visualize.php'){
  res.setHeader('Content-Type','text/plain');
  if(u.searchParams.has('getAll'))res.end(JSON.stringify(productionImport.filter(n=>n.type==='Base')));
  else if(u.searchParams.has('getChild')){
   const parent=Buffer.from(u.searchParams.get('getChild'),'base64').toString();
   res.end(JSON.stringify(parent==='satellite-agent-destination%20'?{}:Object.fromEntries(productionImport.filter(n=>n.id!==parent).map(n=>[n.id,n]))));
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
 await page.evaluate(()=>app.view.createDialog({x:400,y:150,context:app.view,dropped:$('#satellite-agent-destination')}));
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
 assert(!errors.length,errors.join('\n'));
 process.stdout.write('VisualPlan browser smoke passed: OpenAI/Grok trunk forms, cancellation, existing Agent selection/import, fallback rewiring/deletion/undo, secret-free graph, partial-save retry.\n');
 } finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1;});
