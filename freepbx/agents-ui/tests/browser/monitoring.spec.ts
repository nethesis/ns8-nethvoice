import { expect, test, type Page } from '@playwright/test';

test.use({timezoneId: 'Europe/Rome'});

const histogram = {samples: 12, mean_ms: 850, p50_ms: 1000, p95_ms: 2500, approximate: true};
const run = {run_id: '77777777-7777-4777-a777-777777777777',agent_id: 'receptionist',agent_name: 'Receptionist',workflow_version: 11,
  started_at: '2026-10-20 12:00:00',ended_at: '2026-10-20 12:00:20',outcome: 'fallback',
  caller_number: '+39 333 1234567',called_number: '0721405500',
  error_code: 'provider_http_503',provider: 'openai',adapter: 'realtime',model: 'synthetic-model',
  monitoring_version: 2,trace_status: 'partial',incomplete: false,duration_ms: 20000,
  usage: {response_input_tokens: 12},usage_complete: false,events: [],transcripts: []};
const olderRun = {...run, run_id: '88888888-8888-4888-a888-888888888888', outcome: 'completed', error_code: null,
  caller_number: null, called_number: null, duration_ms: 1500};
const summary = {coverage:{total_runs:180,instrumented_runs:180,partial_runs:2,incomplete_runs:1},
  outcomes:[{outcome:'completed',count:36},{outcome:'transferred',count:90},{outcome:'fallback',count:40},{outcome:'failed',count:14}],
  trends:[{day:'2026-10-20',outcome:'transferred',count:120},{day:'2026-10-20',outcome:'failed',count:3}],
  latencies:{run_duration:histogram,setup_duration:histogram,first_output:histogram},
  phases:[{id:'provider_sideband',status:'failed',...histogram}],tools:[{id:'pbx.transfer',status:'completed',...histogram}],
  errors:[{phase:'provider_sideband',error_code:'provider_http_503',count:2}]};

type Seen = {summary: URLSearchParams[]; runs: URLSearchParams[]; searches: Record<string, unknown>[]};
async function mock(page: Page, language: string, options: {timezoneUnavailable?: boolean; paged?: boolean} = {}) {
  page.on('pageerror', error => {throw error;});
  await page.addInitScript(language => {
    localStorage.setItem('secretkey', JSON.stringify({user:'administrator',hash:'synthetic'}));
    localStorage.setItem('nethvoice.agents.language',language);
  }, language);
  const seen: Seen = {summary: [], runs: [], searches: []};
  await page.route('**/freepbx/rest/agents/**', async route => {
    const url=new URL(route.request().url()), path=url.pathname.replace('/freepbx/rest/agents','');
    if(path==='/runs/search') {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-agents-csrf']).toBe('synthetic-csrf');
      const body = route.request().postDataJSON();
      seen.searches.push(body);
      await route.fulfill({json:{items:String(body.query).includes('333')?[run]:[],has_more:false}});
      return;
    }
    if(path==='/monitoring/summary') {
      seen.summary.push(url.searchParams);
      if(options.timezoneUnavailable && url.searchParams.has('timezone')) {
        await route.fulfill({status:422,json:{error:'monitoring_timezone_unavailable'}});
        return;
      }
    }
    if(path==='/runs') seen.runs.push(url.searchParams);
    const json = path==='/access' ? {csrf:'synthetic-csrf'}
      : path==='/catalog' ? {sip_lab_enabled:false}
      : path==='/profiles' ? {items:[{agent_id:'receptionist',name:'Receptionist'},{agent_id:'sales',name:'Sales'}]}
      : path==='/monitoring/summary' ? summary
      : path==='/monitoring/health' ? {stale:false,degraded:true,ari_connected:true,queue_depth:2,oldest_pending_seconds:5,dropped:1,retries:3,last_write_at:'2026-10-20 12:00:00'}
      : path==='/runs' && options.paged ? (url.searchParams.get('page')==='2'
        ? {items:Array.from({length:3},(_,i)=>({...olderRun,run_id:'p2-'+i})),has_more:false}
        : {items:Array.from({length:25},(_,i)=>({...olderRun,run_id:'p1-'+i})),has_more:true})
      : path==='/runs' ? {items:[run, olderRun],has_more:false}
      : {};
    await route.fulfill({json});
  });
  return seen;
}

for (const scenario of [{language:'en',width:1440}, {language:'it',width:390}]) {
  test(`monitoring page ${scenario.language} at ${scenario.width}px`, async ({page}) => {
    const en = scenario.language === 'en';
    await page.setViewportSize({width:scenario.width,height:1000});
    const seen = await mock(page, scenario.language);
    await page.goto('./#/activity');
    await expect(page.getByTestId('monitoring-total')).toHaveText('180');
    await expect(page.getByTestId('monitoring-completed')).toHaveText('36');
    await expect(page.getByText(en ? '20% of calls' : '20% delle chiamate')).toBeVisible();
    await expect(page.getByText(en ? '50% of calls' : '50% delle chiamate')).toBeVisible();
    await expect(page.getByText(en ? '30% of calls' : '30% delle chiamate')).toBeVisible();
    // Daily buckets follow the browser time zone, so no UTC note is needed.
    await expect.poll(() => seen.summary.map(params => params.get('timezone'))).toContain('Europe/Rome');
    await expect(page.getByText(/UTC/)).toHaveCount(0);
    const daily = page.getByTestId('daily-outcomes');
    await expect(daily).toContainText(en ? 'Daily outcomes' : 'Esiti giornalieri');
    await expect(daily).toContainText('123');
    // Numbers are shown exactly as stored, a dash for older runs.
    await expect(page.getByTestId('run-caller').first()).toHaveText('+39 333 1234567');
    await expect(page.getByTestId('run-called').first()).toHaveText('0721405500');
    await expect(page.getByTestId('run-caller').nth(1)).toHaveText('—');
    await expect(page.getByTestId('calls-table')).toContainText(en ? 'The provider replied with HTTP error 503' : 'Il provider ha risposto con errore HTTP 503');
    await expect(page.getByTestId('calls-table')).not.toContainText('provider_http_503');
    // Diagnostics are collapsed until asked for.
    await expect(page.getByText(en ? 'Dropped observations' : 'Misure perse')).toBeHidden();
    await expect(page.getByTestId('monitoring-health-warning')).toContainText(en ? 'Monitoring needs attention' : 'Il monitoraggio richiede attenzione');
    await page.getByRole('button',{name:en ? 'Show diagnostics' : 'Mostra diagnostica'}).click();
    await expect(page.getByText(en ? 'Dropped observations' : 'Misure perse')).toBeVisible();
    await expect(page.getByTestId('diagnostics')).toContainText(en ? 'Calls with partial traces' : 'Chiamate con tracce parziali');
    await expect(page.getByTestId('diagnostics')).toContainText(en ? 'Time to first answer' : 'Tempo alla prima risposta');
    await expect(page.getByTestId('diagnostics')).toContainText(en ? '2.5 s' : '2,5 s');
    // Searching by number goes in the request body, not in the URL.
    await page.getByPlaceholder(en ? 'Filter by number, agent or run ID' : 'Filtra per numero, agente o ID esecuzione').fill('333');
    await expect.poll(() => seen.searches.map(body => body.query)).toContain('333');
    expect(seen.runs.some(params => params.has('query'))).toBe(false);
    await expect(page.getByTestId('run-caller')).toHaveCount(1);
    await page.getByPlaceholder(en ? 'Filter by number, agent or run ID' : 'Filtra per numero, agente o ID esecuzione').fill('nobody');
    await expect(page.getByText(en ? 'No calls found' : 'Nessuna chiamata trovata')).toBeVisible();
    await page.getByRole('button',{name:en ? 'Reset filters' : 'Reimposta filtri'}).last().click();
    await expect(page.getByTestId('run-caller')).toHaveCount(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`/tmp/voice-agent-monitoring-${scenario.language}.png`,fullPage:true});
  });
}

test('every filter reaches the API', async ({page}) => {
  const seen = await mock(page, 'en');
  await page.goto('./#/activity');
  await expect(page.getByTestId('monitoring-total')).toHaveText('180');
  await page.getByRole('button',{name:'Open filter Outcome'}).click();
  await page.getByRole('checkbox',{name:'Transferred'}).check();
  await page.getByRole('checkbox',{name:'Fallback'}).check();
  await page.keyboard.press('Escape');
  await expect.poll(()=>seen.runs.map(params => params.get('outcome'))).toContain('transferred,fallback');
  await page.getByRole('button',{name:'Open filter Agent'}).click();
  await page.getByRole('checkbox',{name:'Sales'}).check();
  await page.keyboard.press('Escape');
  await expect.poll(()=>seen.runs.map(params => params.get('agent_id'))).toContain('sales');
  await expect.poll(()=>seen.summary.map(params => params.get('agent_id'))).toContain('sales');
  await page.getByRole('button',{name:'Open filter Voice provider'}).click();
  await expect(page.getByRole('checkbox',{name:'Grok'})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'OpenAI'}).check();
  await page.keyboard.press('Escape');
  await expect.poll(()=>seen.runs.map(params => params.get('provider'))).toContain('openai');
  await expect.poll(()=>seen.summary.map(params => params.get('provider'))).toContain('openai');
  await page.getByRole('button',{name:'Open filter Period'}).click();
  await page.getByRole('radio',{name:'Last 7 days'}).check();
  await page.keyboard.press('Escape');
  await expect.poll(()=>seen.summary.filter(params => params.get('from')).length).toBeGreaterThan(0);
  const from = new Date(seen.summary.filter(params => params.get('from')).at(-1)!.get('from')!);
  expect(Math.round((Date.now() - from.getTime()) / 86400000)).toBe(7);
  expect(seen.runs.some(params => params.get('from'))).toBe(true);
  await page.getByRole('button',{name:'Reset filters'}).first().click();
  await expect(page.getByRole('button',{name:'Reset filters'}).first()).toBeDisabled();
});

test('daily outcomes fall back to UTC when the server cannot use the time zone', async ({page}) => {
  const seen = await mock(page, 'en', {timezoneUnavailable: true});
  await page.goto('./#/activity');
  await expect(page.getByTestId('monitoring-total')).toHaveText('180');
  await expect(page.getByText('Days are grouped in UTC, because the server cannot use the time zone of your browser.')).toBeVisible();
  expect(seen.summary.some(params => !params.has('timezone'))).toBe(true);
  await expect(page.getByTestId('monitoring-request-error')).toHaveCount(0);
});

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
  await expect(page.getByTestId('monitoring-health-warning')).toContainText('has not reported its status');
  await expect(page.getByTestId('monitoring-total')).toHaveCount(0);
  await page.getByRole('button',{name:'Diagnostics',exact:true}).click();
  await expect(page.getByText('The status of the agent service is not available.',{exact:false})).toBeVisible();
});

for (const language of ['en', 'it']) {
  test(`calls pagination reads without a total (${language})`, async ({page}) => {
    const en = language === 'en';
    const seen = await mock(page, language, {paged: true});
    await page.goto('./#/activity');
    const pagination = page.getByTestId('calls-pagination');
    await expect(pagination).toContainText(en ? 'Calls 1–25' : 'Chiamate 1–25');
    await expect(pagination).not.toContainText(en ? ' of' : ' di');
    const previous = pagination.getByRole('button', {name: en ? 'Previous' : 'Precedente', exact: true});
    const next = pagination.getByRole('button', {name: en ? 'Next' : 'Successiva', exact: true});
    await expect(previous).toBeDisabled();
    await next.click();
    await expect(pagination).toContainText(en ? 'Calls 26–28' : 'Chiamate 26–28');
    expect(seen.runs.at(-1)!.get('page')).toBe('2');
    await expect(next).toBeDisabled();
    await previous.click();
    await expect(pagination).toContainText(en ? 'Calls 1–25' : 'Chiamate 1–25');
  });
}
