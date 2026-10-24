import { expect, test } from '@playwright/test';

const runId = '77777777-7777-4777-a777-777777777777';
const histogram = {samples: 12, mean_ms: 850, p50_ms: 1000, p95_ms: 2500, approximate: true};
const run = {run_id: runId,agent_id: 'receptionist',agent_name: 'Receptionist',workflow_version: 11,
  started_at: '2026-10-20 12:00:00',ended_at: '2026-10-20 12:00:20',outcome: 'fallback',
  error_code: 'provider_http_503',provider: 'openai',adapter: 'realtime',model: 'synthetic-model',
  monitoring_version: 2,trace_status: 'partial',incomplete: false,duration_ms: 20000,
  usage: {response_input_tokens: 12},usage_complete: false,events: [],transcripts: []};

for (const scenario of [{language:'en',width:1440}, {language:'it',width:375}]) {
  test(`monitoring dashboard and nested trace ${scenario.language}`, async ({page}) => {
    await page.setViewportSize({width:scenario.width,height:1000});
    page.on('pageerror', error => {throw error;});
    await page.addInitScript(language => {
      localStorage.setItem('secretkey', JSON.stringify({user:'administrator',hash:'synthetic'}));
      localStorage.setItem('nethvoice.agents.language',language);
    }, scenario.language);
    const searches:string[]=[];
    await page.route('**/freepbx/rest/agents/**', async route => {
      const url=new URL(route.request().url()), path=url.pathname.replace('/freepbx/rest/agents','');
      let json:unknown = {};
      if(path==='/access') json={csrf:'synthetic-csrf'};
      else if(path==='/profiles') json={items:[{agent_id:'receptionist',name:'Receptionist'}]};
      else if(path==='/monitoring/summary') json={coverage:{total_runs:180,instrumented_runs:180,partial_runs:2,incomplete_runs:1},outcomes:[{outcome:'transferred',count:120},{outcome:'fallback',count:60}],trends:[{day:'2026-10-20',outcome:'transferred',count:120}],latencies:{run_duration:histogram,setup_duration:histogram,first_output:histogram},phases:[{id:'provider_sideband',status:'failed',...histogram}],tools:[{id:'pbx.transfer',status:'completed',...histogram}],errors:[{phase:'provider_sideband',error_code:'provider_http_503',count:2}]};
      else if(path==='/monitoring/health') json={stale:false,degraded:true,ari_connected:true,queue_depth:2,oldest_pending_seconds:5,dropped:1,retries:3,last_write_at:'2026-10-20 12:00:00'};
      else if(path==='/runs') { searches.push(url.searchParams.get('query')||''); json={items:[run],has_more:false}; }
      else if(path===`/runs/${runId}`) json=run;
      else if(path===`/runs/${runId}/trace`) json={items:[
        {event_id:'a',event_type:'trace_started',span_id:'parent',parent_span_id:null,phase:'tool',status:'running',elapsed_ms:100,duration_ms:null,occurred_at:'2026-10-20 12:00:00'},
        {event_id:'b',event_type:'trace_finished',span_id:'child',parent_span_id:'parent',phase:'provider_sideband',status:'failed',elapsed_ms:500,duration_ms:400,http_status:503,error_code:'provider_http_503',occurred_at:'2026-10-20 12:00:01'}],next_cursor:null};
      await route.fulfill({json});
    });
    await page.goto('./#/activity');
    await expect(page.getByTestId('monitoring-total')).toHaveText('180');
    await expect(page.getByTestId('monitoring-health-warning')).toBeVisible();
    await page.getByTestId('run-search').fill('outside-first-page');
    await expect.poll(()=>searches.includes('outside-first-page')).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`/tmp/voice-agent-monitoring-${scenario.language}.png`,fullPage:true});
    await page.getByRole('link',{name:scenario.language==='en'?'Open':'Apri',exact:true}).click();
    await expect(page.getByTestId('trace-partial')).toBeVisible();
    await expect(page.getByTestId('trace-timeline')).toContainText('503');
    await expect(page.getByTestId('trace-timeline')).toContainText('400');
    await expect(page.getByTestId('trace-usage')).toContainText('12');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('unavailable metrics show errors rather than fabricated zero counts', async ({page}) => {
  await page.addInitScript(()=> {
    localStorage.setItem('secretkey',JSON.stringify({user:'administrator',hash:'synthetic'}));
    localStorage.setItem('nethvoice.agents.language','en');
  });
  await page.route('**/freepbx/rest/agents/**', async route=> {
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/summary')) await route.fulfill({status:503,json:{error:'request_failed'}});
    else await route.fulfill({json:path.endsWith('/access')?{csrf:'synthetic'}:path.endsWith('/health')?{stale:true,observed_at:null}:{items:[],has_more:false}});
  });
  await page.goto('./#/activity');
  await expect(page.getByTestId('monitoring-request-error')).toBeVisible();
  await expect(page.getByTestId('monitoring-health-warning')).toBeVisible();
  await expect(page.getByTestId('monitoring-total')).toHaveCount(0);
});
