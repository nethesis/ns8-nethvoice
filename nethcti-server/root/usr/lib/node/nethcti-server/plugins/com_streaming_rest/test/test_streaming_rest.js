/**
 * Tests of the streaming REST plugin: validation of the "open" parameters and
 * answers of the video gateway authentication hook.
 *
 * Run with: node plugins/com_streaming_rest/test/test_streaming_rest.js
 *
 * @module com_streaming_rest
 * @submodule test
 */
var assert = require('assert');
var rest = require('../plugins_rest/streaming');

var quiet = { info: function() {}, warn: function() {}, error: function() {} };
rest.setLogger({ log: quiet });

var opened = [];
var decisions = [];
rest.setCompStreaming({
  openGate: function(stream, gate, callerid, exten, username, cb) {
    opened.push({ stream: stream, gate: gate });
    cb(null);
  },
  getVideoSample: function(id, cb) {
    if (id === 'vs_changed') {
      var e = new Error('the TLS certificate of the video source device changed');
      e.status = 502;
      e.code = 'source_certificate_changed';
      cb(e);
    } else if (id === 'vs_off') {
      cb('ECONNREFUSED');
    } else {
      cb(null, 'data:image/jpeg;base64,AA==');
    }
  },
  authorizeGatewayRequest: function(body, cb) {
    // asynchronous like the refresh of the gateway sessions
    setImmediate(function() { cb(decisions.shift()); });
  }
});
rest.setCompAuthorization({
  getAllowedStreamingSources: function() {
    return [{ permissionId: 'vs_door' }, { permissionId: 'vs_changed' }, { permissionId: 'vs_off' }];
  }
});
rest.setCompConfigManager({ getDefaultUserExtensionConf: function() { return '201'; } });
rest.setCompUtil({ net: {
  sendHttp200: function(id, res) { res.send(200); },
  sendHttp403: function(id, res) { res.send(403); },
  sendHttp500: function(id, res) { res.send(500); }
} });

function fakeRes() {
  return {
    status: null,
    body: null,
    send: function(status, body) { this.status = status; this.body = body; },
    writeHead: function(status) { this.status = status; },
    end: function(body) { this.body = body; }
  };
}
function open(params) {
  var res = fakeRes();
  rest.open({ headers: { authorization_user: 'alice' }, params: params }, res, function() {});
  return res;
}

var res = open({ id: 'vs_door', gate: '2' });
assert.strictEqual(res.status, 200);
assert.deepStrictEqual(opened.pop(), { stream: 'vs_door', gate: '2' });
res = open({ id: 'vs_door', gate: 2 });
assert.strictEqual(res.status, 200, 'numeric gate id');
assert.deepStrictEqual(opened.pop(), { stream: 'vs_door', gate: '2' });
res = open({ id: 'vs_door' });
assert.strictEqual(res.status, 200, 'no gate: the first one');
assert.strictEqual(opened.pop().gate, undefined);
[['2'], { a: 1 }, true, NaN, Infinity].forEach(function(g) {
  var r = open({ id: 'vs_door', gate: g });
  assert.strictEqual(r.status, 400, 'gate ' + JSON.stringify(g));
  assert.strictEqual(r.body.code, 'invalid_gate');
});
assert.strictEqual(opened.length, 0, 'nothing opened with an invalid gate');
assert.strictEqual(open({ id: ['vs_door'] }).body.code, 'missing_id');
console.log('ok - open parameters');

function image(source) {
  var r = fakeRes();
  rest.image({ headers: { authorization_user: 'alice' }, params: { source: source } }, r, function() {});
  return r;
}
res = image('vs_door');
assert.strictEqual(res.status, 200);
res = image('vs_changed');
assert.strictEqual(res.status, 502, 'changed certificate: 502');
assert.deepStrictEqual(Object.keys(res.body), ['code', 'message']);
assert.strictEqual(res.body.code, 'source_certificate_changed');
assert.strictEqual(image('vs_off').status, 500, 'other failures unchanged');
console.log('ok - image errors');

decisions = [{ allow: true, reason: 'valid token', username: 'alice' }, { allow: false, reason: 'token already used' }];
var hookRes = fakeRes();
rest.gatewayAuth({ body: { action: 'read', path: 'streaming-gw/vs_door', protocol: 'webrtc', id: 's1' } }, hookRes, function() {});
var hookRes2 = fakeRes();
rest.gatewayAuth({ body: { action: 'read', path: 'streaming-gw/vs_door', protocol: 'webrtc', id: 's2' } }, hookRes2, function() {});
setTimeout(function() {
  assert.strictEqual(hookRes.status, 200);
  assert.strictEqual(hookRes2.status, 401);
  assert.strictEqual(hookRes2.body, 'denied: token already used');
  console.log('ok - gateway hook answers');
  console.log('\n3 groups passed');
}, 50);
