'use strict';

var childProcess = require('child_process');

var RENDER_TIMEOUT = 3000;
var MAX_OUTPUT = 2 * 1024 * 1024;
var MAX_ERROR_LENGTH = 2000;
var SERVER_PATH = /\/(?:app|usr|var|etc|root|home|tmp|opt|proc|sys|srv|lib|bin|run|dev)\/[^\s'"`)]*/g;

function describeError(err) {
  var message = err && typeof err.message === 'string' ? err.message : String(err);
  return message.replace(SERVER_PATH, '…').slice(0, MAX_ERROR_LENGTH);
}

function renderTemplate(template, results, cb) {
  var child = childProcess.execFile(process.execPath, ['--max-old-space-size=64', __filename], {
    env: {},
    timeout: RENDER_TIMEOUT,
    killSignal: 'SIGKILL',
    maxBuffer: MAX_OUTPUT
  }, function (err, stdout) {
    if (err && err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      cb(null, { error: 'The rendered card is larger than 2 MB' });
      return;
    }
    if (err && err.killed) {
      cb(null, { error: 'The template took longer than 3 seconds to render' });
      return;
    }
    var answer;
    try {
      answer = JSON.parse(stdout);
    } catch (parseError) {
      answer = null;
    }
    if (answer && typeof answer.html === 'string') {
      cb(null, { html: answer.html });
    } else if (answer && typeof answer.error === 'string') {
      cb(null, { error: answer.error });
    } else {
      cb(err || new Error('the template renderer returned no answer'));
    }
  });
  child.stdin.on('error', function () {});
  child.stdin.end(JSON.stringify({ template: template, results: results }));
}

function renderStandardInput() {
  var input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function (chunk) {
    input += chunk;
  });
  process.stdin.on('end', function () {
    var answer;
    try {
      var data = JSON.parse(input);
      answer = { html: require('ejs').render(data.template, { name: '', results: data.results }) };
    } catch (err) {
      answer = { error: describeError(err) };
    }
    process.stdout.write(JSON.stringify(answer), function () {
      process.exit(0);
    });
  });
}

if (require.main === module) {
  renderStandardInput();
}

exports.renderTemplate = renderTemplate;
exports.describeError = describeError;
