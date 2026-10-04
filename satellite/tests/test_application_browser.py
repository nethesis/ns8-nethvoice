"""Real Angular forms with fixture services; requires Playwright and pinned UI libraries."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--libraries', type=Path, required=True, help='node_modules with angular, angular-translate, bootstrap')
parser.add_argument('--browser', default='/usr/bin/google-chrome')
args=parser.parse_args()
root=Path(__file__).resolve().parents[2]
frontend=root/'freepbx/wizard-ui/app'
libs=args.libraries.resolve()
output=root/'satellite/test-evidence'
output.mkdir(exist_ok=True)
errors=[]
fixture={'health':{'available':True},'enabled':True,'resources':[], 'versions':[], 'grants':[], 'clients':[], 'secrets':[{'secret_id':'provider-key','revoked':False}],'unresolved_effects':[]}
script=r'''
window.mutations=[];
angular.module('nethvoiceWizardUiApp',['pascalprecht.translate']).config(function($translateProvider){
 $translateProvider.translations('test',window.labels).preferredLanguage('test').useSanitizeValueStrategy('escape');
}).value('$location',{path:function(){return window.testPage;}}).run(function($rootScope){
 $rootScope.login={isLogged:true}; $rootScope.view={};
}).factory('AgentsService',function($q){
 return {clear:function(){},access:function(){return $q.when({csrf:'test'});},
 request:function(method,path){return $q.when(angular.copy(window.fixture));},
 mutate:function(method,path,data){ window.mutations.push({method:method,path:path,data:data});
 return $q.when(path==='/application/clients'?{token:'nv_agent_synthetic_browser_token'}:{revision:1,version:1});}};
});
'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
 for lang in ['en','it']:
  for kind in ['connectors','api']:
   page=browser.new_page(viewport={'width':1280,'height':900})
   page.on('pageerror',lambda error:errors.append(str(error)))
   labels=json.loads((frontend/f'scripts/i18n/locale-{lang}.json').read_text())
   page.set_content('<html><head><meta charset="utf-8"><style>'+ (libs/'bootstrap/dist/css/bootstrap.css').read_text()+'\n'+(frontend/'styles/agents.css').read_text()+'</style></head><body ng-controller="AgentIntegrationsCtrl as integration">'+(frontend/f'views/agents/{kind}.html').read_text()+'</body></html>')
   page.add_script_tag(content=(libs/'angular/angular.js').read_text())
   page.add_script_tag(content=(libs/'angular-translate/dist/angular-translate.js').read_text())
   page.evaluate('(args)=>{window.fixture=args.fixture;window.labels=args.labels;window.testPage=args.path}',{'fixture':fixture,'labels':labels,'path':'/agents/api' if kind=='api' else '/agents/connectors'})
   page.add_script_tag(content=(frontend/'scripts/app.js').read_text().split('/**')[0])
   page.add_script_tag(content=script)
   page.add_script_tag(content=(frontend/'scripts/controllers/agentintegrations.js').read_text())
   page.evaluate("angular.bootstrap(document.body,['nethvoiceWizardUiApp'])")
   page.wait_for_function("!angular.element(document.body).scope().integration.loading")
   if kind=='connectors':
    page.get_by_role('button',name=labels['Agents']['new_connector'],exact=True).click()
    page.get_by_label(labels['Agents']['connector_id'],exact=True).fill('business')
    page.get_by_label(labels['Agents']['name'],exact=True).fill('Business service')
    page.get_by_label(labels['Agents']['service_origin'],exact=True).fill('https://business.example')
    page.get_by_label(labels['Agents']['credential_id'],exact=True).last.select_option('provider-key')
    page.get_by_label(labels['Agents']['description'],exact=True).fill('Customer lookup')
    page.get_by_role('button',name=labels['Agents']['save_draft'],exact=True).click()
    page.wait_for_function('window.mutations.length > 0')
    mutations=page.evaluate('window.mutations')
    assert mutations[-1]['data']['definition']['operations'][0]['input_schema']['type']=='object'
    assert mutations[-1]['data']['expected_revision']==0
   else:
    page.get_by_role('button',name=labels['Agents']['configure_api_agent'],exact=True).click()
    page.get_by_label(labels['Agents']['model'],exact=True).fill('configured-responses-model')
    page.get_by_label(labels['Agents']['credential_id'],exact=True).select_option('provider-key')
    page.get_by_role('button',name=labels['Agents']['save_draft'],exact=True).click()
    page.wait_for_function('window.mutations.length > 0')
    assert page.evaluate('window.mutations[0].data.definition.provider')=='openai_responses'
    page.get_by_label(labels['Agents']['client_id'],exact=True).first.fill('browser-client')
    page.get_by_label(labels['Agents']['authorized_customers'],exact=True).fill('customer-1')
    page.get_by_role('button',name=labels['Agents']['create_client'],exact=True).click()
    page.get_by_text('nv_agent_synthetic_browser_token',exact=True).wait_for()
   page.screenshot(path=str(output/f'phase4-{kind}-{lang}-desktop.png'),full_page=True)
   page.set_viewport_size({'width':390,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), (kind,lang,'horizontal overflow')
   page.screenshot(path=str(output/f'phase4-{kind}-{lang}-mobile.png'),full_page=True)
   page.evaluate("var s=angular.element(document.body).scope();s.login.isLogged=false;s.$apply();")
   assert page.evaluate('angular.element(document.body).scope().integration.token') is None
   assert page.get_by_text('nv_agent_synthetic_browser_token',exact=True).count()==0
   page.close()
 browser.close()
assert not errors,errors
print('English/Italian desktop/mobile forms, payloads, token clearing and overflow checks passed')
