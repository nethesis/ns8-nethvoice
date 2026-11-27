const assert = require('assert');
const renderTemplate = require('../render_template').renderTemplate;

const render = (template, results) => new Promise((resolve, reject) => {
  renderTemplate(template, results, (err, answer) => (err ? reject(err) : resolve(answer)));
});

(async () => {
  let answer = await render('<% results.forEach(function (row) { %><p><%= row.name %> <%- row.city %></p><% }) %>', [
    { name: 'Zoë <b>', city: 'Forlì' },
    { name: 'Ana', city: 'Cesena' }
  ]);
  assert.deepStrictEqual(answer, { html: '<p>Zoë &lt;b&gt; Forlì</p><p>Ana Cesena</p>' });

  answer = await render('<%= results.length %><%= name %>', []);
  assert.deepStrictEqual(answer, { html: '0' });

  answer = await render('<p>\n<%= missing.total %>\n</p>', []);
  assert.ok(answer.error.includes('missing is not defined'), answer.error);
  assert.ok(answer.error.includes('>> 2| <%= missing.total %>'), answer.error);
  assert.ok(!answer.error.includes(__dirname), answer.error);
  assert.strictEqual(answer.html, undefined);

  answer = await render('<% if (results.length { %>', []);
  assert.ok(answer.error.length > 0 && answer.html === undefined);

  answer = await render("<% throw new Error('cannot open /etc/nethcti/nethcti.json or /app/plugins/x.js') %>", []);
  assert.ok(answer.error.includes('cannot open … or …'), answer.error);
  assert.ok(!answer.error.includes('/etc/') && !answer.error.includes('/app/'), answer.error);

  process.env.NETHCTI_RENDER_TEST_SECRET = 'secret-value';
  answer = await render('<%= typeof process.env.NETHCTI_RENDER_TEST_SECRET %>', []);
  assert.deepStrictEqual(answer, { html: 'undefined' });

  answer = await render("<%= 'x'.repeat(3 * 1024 * 1024) %>", []);
  assert.deepStrictEqual(answer, { error: 'The rendered card is larger than 2 MB' });

  let ticks = 0;
  const ticker = setInterval(() => { ticks++; }, 100);
  answer = await render('<% while (true) {} %>', []);
  clearInterval(ticker);
  assert.deepStrictEqual(answer, { error: 'The template took longer than 3 seconds to render' });
  assert.ok(ticks >= 10, 'the server process was blocked while rendering: ' + ticks + ' ticks');

  answer = await render('<% setInterval(function () {}, 1000) %>done', []);
  assert.deepStrictEqual(answer, { html: 'done' });

  console.log('PASS: templates render outside the server process, with errors, limits and no environment');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
