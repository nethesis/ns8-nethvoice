import { expect, test, type Page } from '@playwright/test';

test.use({timezoneId: 'Europe/Rome'});

const runId = '77777777-7777-4777-a777-777777777777';
const base = {run_id: runId,agent_id: 'receptionist',agent_name: 'Receptionist',workflow_version: 11,
  started_at: '2026-10-20 12:00:00',ended_at: '2026-10-20 12:00:20',
  caller_number: '+39 333 1234567',called_number: '0721405500',
  provider: 'openai',adapter: 'live_ws',model: 'gpt-live-1',published_by: 'admin',
  monitoring_version: 2,trace_status: 'partial',incomplete: false,duration_ms: 20000,setup_duration_ms: 1500,first_output_ms: 2700,
  usage: {backend_input_tokens: 39148, live_seconds: 86},usage_complete: true,events: [],
  call_record_url: '/freepbx/admin/config.php?display=cdr&action=cdr_record&uid=1.2#CDR',
  transcripts: [{role:'assistant',text:'Buongiorno',occurred_at:'2026-10-20 12:00:02',interrupted:false,truncated:false},
    {role:'caller',text:'Vorrei parlare con Matteo',occurred_at:'2026-10-20 12:00:05',interrupted:false,truncated:false}]};
const trace = [
  {event_id:'a',event_type:'trace_started',span_id:'parent',parent_span_id:null,phase:'tool',status:'running',elapsed_ms:100,duration_ms:null,occurred_at:'2026-10-20 12:00:00'},
  {event_id:'b',event_type:'trace_finished',span_id:'child',parent_span_id:'parent',phase:'provider_sideband',status:'failed',elapsed_ms:500,duration_ms:400,http_status:503,error_code:'provider_http_503',occurred_at:'2026-10-20 12:00:01'},
  {event_id:'c',event_type:'provider_warning',provider_code:'input_audio_rate_limit_exceeded',elapsed_ms:1500,occurred_at:'2026-10-20 12:00:02'},
  {event_id:'d',event_type:'consultation_announced',elapsed_ms:3000,occurred_at:'2026-10-20 12:00:03'},
  {event_id:'e',event_type:'consultation_held',elapsed_ms:3100,occurred_at:'2026-10-20 12:00:03'}];

async function open(page: Page, language: string, run: Record<string, unknown>) {
  page.on('pageerror', error => {throw error;});
  await page.addInitScript(language => {
    localStorage.setItem('secretkey', JSON.stringify({user:'administrator',hash:'synthetic'}));
    localStorage.setItem('preferredLanguage', JSON.stringify(language));
  }, language);
  await page.route('**/freepbx/rest/agents/**', async route => {
    const path=new URL(route.request().url()).pathname.replace('/freepbx/rest/agents','');
    const json = path==='/access' ? {csrf:'synthetic-csrf'}
      : path===`/runs/${runId}/trace` ? {items:trace,next_cursor:null}
      : path===`/runs/${runId}` ? run : {};
    await route.fulfill({json});
  });
  await page.goto(`./#/activity/${runId}`);
}

for (const scenario of [{language:'en',width:1440}, {language:'it',width:390}]) {
  test(`fallback call details ${scenario.language} at ${scenario.width}px`, async ({page}) => {
    const en = scenario.language === 'en';
    await page.setViewportSize({width:scenario.width,height:1000});
    await open(page, scenario.language, {...base, outcome:'fallback', error_code:'provider_unavailable'});
    await expect(page.getByRole('heading',{name:en?'Call details':'Dettagli chiamata'})).toBeVisible();
    const notice = page.getByTestId('run-outcome-notice');
    await expect(notice).toContainText(en ? 'Sent to fallback destination' : 'Inviata alla destinazione alternativa');
    await expect(notice).toContainText(en ? 'The provider was not reachable. The call went to the fallback destination of the route.' : 'La chiamata è stata inviata alla destinazione alternativa');
    await expect(notice).not.toContainText(en ? 'Call failed' : 'Chiamata non riuscita');
    await expect(page.getByText('provider_unavailable',{exact:false})).toBeHidden();
    await notice.getByRole('button',{name:en?'Show details':'Mostra dettagli'}).click();
    await expect(page.getByText(en ? 'Error code: provider_unavailable' : 'Codice di errore: provider_unavailable')).toBeVisible();
    const summary = page.getByTestId('run-summary');
    await expect(summary).toContainText('+39 333 1234567');
    await expect(summary).toContainText('0721405500');
    await expect(summary).toContainText(en ? '20 Oct 2026, 14:00:00' : '20 ott 2026, 14:00:00');
    await expect(summary).toContainText(en ? '20 s' : '20 s');
    await expect(summary.getByRole('link',{name:en?'Open call record':'Apri il registro della chiamata'})).toHaveAttribute('href',/display=cdr/);
    await expect(page.getByTestId('run-provider-warning')).toContainText(en ? 'The provider dropped some caller audio because it arrived too fast' : "Il provider ha scartato parte dell'audio del chiamante");
    await expect(page.getByRole('textbox',{name:en?'Call transcription':'Trascrizione della chiamata'})).toHaveValue(/Vorrei parlare con Matteo/);
    // Diagnostics stay collapsed until opened.
    await expect(page.getByTestId('trace-timeline')).toBeHidden();
    await page.getByRole('button',{name:en?'Diagnostics':'Diagnostica',exact:true}).click();
    await expect(page.getByTestId('trace-partial')).toBeVisible();
    await expect(page.getByTestId('trace-timeline')).toContainText(en ? 'Provider warning' : 'Avviso del provider');
    await expect(page.getByTestId('trace-timeline')).not.toContainText('503');
    // Consultation steps have readable names, never the event identifier.
    await expect(page.getByTestId('trace-timeline')).toContainText(en ? 'Consultation announced to caller' : 'Consultazione annunciata al chiamante');
    await expect(page.getByTestId('trace-timeline')).toContainText(en ? 'Caller on hold' : 'Chiamante in attesa');
    await expect(page.getByTestId('trace-timeline')).not.toContainText('consultation_');
    await page.getByTestId('trace-timeline').locator('button[aria-expanded="false"]').first().click();
    await expect(page.getByTestId('trace-timeline')).toContainText('503');
    await expect(page.getByTestId('trace-usage')).toContainText(en ? '39,148' : '39.148');
    await expect(page.getByTestId('run-diagnostics')).toContainText(en ? '1.5 s' : '1,5 s');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`/tmp/voice-agent-run-${scenario.language}.png`,fullPage:true});
  });
}

test('failed and completed calls use the backend outcome', async ({page}) => {
  let run: Record<string, unknown> = {...base, outcome:'failed', error_code:'destination_denied', transcripts:[], call_record_url:null, caller_number:null, called_number:null};
  await page.addInitScript(() => {
    localStorage.setItem('secretkey', JSON.stringify({user:'administrator',hash:'synthetic'}));
    localStorage.setItem('preferredLanguage', JSON.stringify('en'));
  });
  await page.route('**/freepbx/rest/agents/**', async route => {
    const path=new URL(route.request().url()).pathname.replace('/freepbx/rest/agents','');
    await route.fulfill({json: path==='/access' ? {csrf:'synthetic-csrf'} : path.endsWith('/trace') ? {items:[],next_cursor:null} : run});
  });
  await page.goto(`./#/activity/${runId}`);
  await expect(page.getByTestId('run-outcome-notice')).toContainText('Call failed');
  await expect(page.getByTestId('run-outcome-notice')).toContainText('The destination is not permitted for this agent.');
  await expect(page.getByTestId('run-outcome-notice')).not.toContainText('fallback');
  await expect(page.getByTestId('run-summary')).toContainText('—');
  await expect(page.getByTestId('run-transcription')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Open call record'})).toHaveCount(0);
  run = {...run, outcome:'completed', error_code:null};
  await page.getByRole('button',{name:'Refresh'}).click();
  await expect(page.getByTestId('run-outcome-notice')).toHaveCount(0);
  await expect(page.getByTestId('run-summary')).toContainText('Completed');
});
