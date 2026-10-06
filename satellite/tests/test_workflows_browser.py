"""Exercise the real AngularJS/Drawflow editor with an isolated admin fixture."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright, expect
from agent.workflows.templates import templates
from agent.workflows.contracts import BLOCKS

ROOT=Path(__file__).resolve().parents[2]
FRONT=ROOT/'freepbx/wizard-ui/app'
LIB=Path(os.getenv('PHASE5_UI_LIBRARIES','/tmp/nethvoice-phase4-browser/node_modules'))
OUTPUT=ROOT/'satellite/test-evidence'


def main():
    OUTPUT.mkdir(exist_ok=True)
    errors=[]; samples=templates()
    fixture={'definitions':[{'kind':'agent','agent_id':samples[0]['agent_id'],'revision':1,'active_version':0,'published_version':0,'enabled':False,'draft':samples[0]}],
        'agents':[], 'versions':[], 'data_sources':[], 'bindings':[{'id':'1','name':'#1 openai'}], 'blocks':BLOCKS}
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
        for lang in ['en','it']:
            for width in [1440,390]:
                page=browser.new_page(viewport={'width':width,'height':1000})
                page.on('pageerror',lambda error:errors.append(str(error)))
                style=(LIB/'bootstrap/dist/css/bootstrap.css').read_text()+'\n'+(FRONT/'lib/drawflow/drawflow.min.css').read_text()+'\n'+(FRONT/'styles/workflows.css').read_text()
                page.set_content('<html><head><meta charset="utf-8"><style>'+style+'</style></head><body ng-controller="AgentWorkflowsCtrl as builder">'+(FRONT/'views/agents/workflows.html').read_text()+'</body></html>')
                for file in [LIB/'angular/angular.js',LIB/'angular-translate/dist/angular-translate.js',FRONT/'lib/drawflow/drawflow.min.js']:
                    page.add_script_tag(content=file.read_text())
                page.evaluate('(args)=>{window.fixture=args.fixture;window.templates=args.templates;window.labels=args.labels}',{'fixture':fixture,'templates':samples,'labels':json.loads((FRONT/f'scripts/i18n/locale-{lang}.json').read_text())})
                page.add_script_tag(content=(FRONT/'scripts/app.js').read_text().split('/**')[0])
                page.add_script_tag(content=r'''
window.mutations=[];
angular.module('nethvoiceWizardUiApp',['pascalprecht.translate']).config(function($translateProvider){
 $translateProvider.translations('test',window.labels).preferredLanguage('test').useSanitizeValueStrategy('escape');
}).value('$routeParams',{kind:'agent',agentId:'call-router'}).value('$location',{path:function(){return '/agents/build/agent/call-router';}})
.run(function($rootScope){$rootScope.login={isLogged:true};$rootScope.view={};})
.factory('AgentsService',function($q){return {access:function(){return $q.when({csrf:'fixture'});},
 request:function(method,path){return $q.when(path.indexOf('/catalog')>=0?{templates:window.templates,blocks:window.fixture.blocks}:angular.copy(window.fixture));},
 mutate:function(method,path,input){window.mutations.push({method:method,path:path,input:angular.copy(input)});return $q.when(path.indexOf('/validate')>=0?{valid:true,tools:[]}:{revision:2,version:1});}};});
''')
                for file in ['scripts/services/workfloweditor.js','scripts/directives/workflowfields.js','scripts/controllers/agentworkflows.js']:
                    page.add_script_tag(content=(FRONT/file).read_text())
                page.evaluate("angular.bootstrap(document.body,['nethvoiceWizardUiApp'])")
                page.wait_for_function("document.querySelectorAll('#workflow-canvas .drawflow-node').length===6")
                labels=json.loads((FRONT/f'scripts/i18n/locale-{lang}.json').read_text())['Builder']
                assert page.locator('#workflow-canvas .drawflow-node').count()==6
                page.get_by_label(labels['list_editor']).check()
                page.get_by_role('button',name='Destinations · pbx.catalog').click()
                page.get_by_label('extension',exact=True).check()
                page.get_by_role('button',name=labels['save'],exact=True).first.click()
                page.wait_for_function('window.mutations.length>0')
                saved=page.evaluate('window.mutations[0].input.definition')
                assert saved['nodes'][1]['config']['defaults']['extension'] is True
                assert len(saved['edges'])==7
                # Both conversation nodes reuse the same inspector directives.
                page.evaluate("var vm=angular.element(document.body).scope().builder;var other=angular.copy(vm.graph.nodes.find(n=>n.id==='choose'));other.id='other_conversation';other.config.outcomes=['again'];other.config.tools=['connector.example.read.v1'];vm.graph.nodes.push(other);vm.select('choose');angular.element(document.body).scope().$apply();")
                expect(page.get_by_label(labels['field']['outcomes'], exact=True)).to_have_value('pbx, agent, fallback')
                expect(page.get_by_label(labels['field']['tools'], exact=True)).to_have_value('')
                page.evaluate("var vm=angular.element(document.body).scope().builder;vm.select('other_conversation');angular.element(document.body).scope().$apply();")
                expect(page.get_by_label(labels['field']['outcomes'], exact=True)).to_have_value('again')
                expect(page.get_by_label(labels['field']['tools'], exact=True)).to_have_value('connector.example.read.v1')
                page.get_by_label(labels['field']['outcomes'], exact=True).fill('again, fallback')
                page.get_by_label(labels['field']['tools'], exact=True).fill('connector.example.other.v1')
                values = page.evaluate("angular.element(document.body).scope().builder.graph.nodes.filter(n=>n.id==='choose'||n.id==='other_conversation').map(n=>({id:n.id,outcomes:n.config.outcomes,tools:n.config.tools}))")
                assert values == [
                    {'id': 'choose', 'outcomes': ['pbx','agent','fallback'], 'tools': []},
                    {'id': 'other_conversation', 'outcomes': ['again','fallback'], 'tools': ['connector.example.other.v1']}]
                page.evaluate("var vm=angular.element(document.body).scope().builder;vm.select('choose');angular.element(document.body).scope().$apply();")
                expect(page.get_by_label(labels['field']['outcomes'], exact=True)).to_have_value('pbx, agent, fallback')
                expect(page.get_by_label(labels['field']['tools'], exact=True)).to_have_value('')
                page.evaluate("var vm=angular.element(document.body).scope().builder;vm.graph.nodes=vm.graph.nodes.filter(n=>n.id!=='other_conversation');vm.select('call');vm.changed();angular.element(document.body).scope().$apply();")
                page.get_by_label(labels['list_editor']).uncheck()
                page.evaluate("var vm=angular.element(document.body).scope().builder;vm.graph.nodes[0].name='<img src=x onerror=window.injected=1>';vm.changed();vm.select('call');angular.element(document.body).scope().$apply();")
                page.get_by_role('button',name=labels['validate'],exact=True).click()
                expect(page.get_by_text(labels['valid'],exact=True)).to_be_visible()
                assert page.evaluate('window.injected') is None
                assert page.locator('#workflow-canvas img').count()==0
                page.get_by_role('button',name=labels['undo'],exact=True).click()
                page.wait_for_function("document.querySelectorAll('#workflow-canvas .drawflow-node').length===6")
                page.get_by_label(labels['list_editor']).check()
                expect(page.locator('#workflow-canvas')).to_be_hidden()
                page.get_by_label(labels['list_editor']).uncheck()
                expect(page.locator('#workflow-canvas')).to_be_visible()
                page.get_by_role('button',name=labels['redo'],exact=True).click()
                page.wait_for_function("document.querySelectorAll('#workflow-canvas .drawflow-node').length===6")
                page.evaluate("var vm=angular.element(document.body).scope().builder;vm.graph.nodes[0].name='Call';vm.changed();vm.select('call');vm.zoom('fit');angular.element(document.body).scope().$apply();")
                duration=page.evaluate('''()=>{
                  const service=angular.element(document.body).injector().get('WorkflowEditor');
                  const element=document.createElement('div');element.style.width='1000px';element.style.height='600px';document.body.appendChild(element);
                  const graph={nodes:[],edges:[],layout:{}};for(let i=0;i<100;i++){graph.nodes.push({id:'node'+i,name:'Node '+i,type:'logic.map',config:{},inputs:{}});graph.layout['node'+i]={x:(i%10)*260,y:Math.floor(i/10)*180};if(i)graph.edges.push({source:'node'+(i-1),outcome:'success',target:'node'+i});}
                  const start=performance.now();for(let repeat=0;repeat<3;repeat++){const canvas=service.attach(element,graph,window.fixture.blocks,()=>{},()=>{});if(element.querySelectorAll('.drawflow-node').length!==100)throw Error('Missing nodes');canvas.destroy();if(element.children.length)throw Error('Leaked canvas');}element.remove();return performance.now()-start;
                }''')
                assert duration<3000, duration
                page.screenshot(path=str(OUTPUT/f'phase5-editor-{lang}-{width}.png'),full_page=True)
                assert page.evaluate('document.documentElement.scrollWidth')<=width+1
                page.evaluate("var scope=angular.element(document.body).scope();scope.login.isLogged=false;scope.$apply();")
                expect(page.locator('#workflow-canvas')).to_have_count(0)
                assert page.evaluate("angular.element(document.body).scope().builder.agents.length")==0
                page.close()
        browser.close()
    assert not errors,errors
    print('Phase 5 editor EN/IT desktop/mobile, undo/re-entry, list controls, safe labels, 100-node rendering and logout passed')


if __name__=='__main__': main()
