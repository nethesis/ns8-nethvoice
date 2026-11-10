/**
 * Tests of the streaming component: configuration parsing, data sent to the
 * clients, stream tokens, video gateway authentication hook, sessions
 * revocation, gates, authenticated snapshots and the per source TLS
 * certificate verification (self-signed devices, needs the openssl command).
 *
 * Run with: node plugins/streaming/test/test_streaming.js
 *
 * @module streaming
 * @submodule test
 */
var assert = require('assert');
var childProcess = require('child_process');
var crypto = require('crypto');
var fs = require('fs');
var http = require('http');
var https = require('https');
var os = require('os');
var path = require('path');

var streaming = require('../streaming');
var deviceHttp = require('../device_http');

var logs = [];
var quietLog = {
  info: function() { logs.push(['info'].concat([].slice.call(arguments)).join(' ')); },
  warn: function() { logs.push(['warn'].concat([].slice.call(arguments)).join(' ')); },
  error: function() { logs.push(['error'].concat([].slice.call(arguments)).join(' ')); }
};
streaming.setLogger({ log: quietLog });

var SECRETS = ['Door-Spike-42', 'Gate-Spike-77', 'Img-Secret-9', 'legacy-secret'];

// permissions: user -> source ids
var perms = {
  alice: ['vs_rtsp', 'vs_img', 'vs_old', 'vs_rtsp2'],
  bob: ['vs_img']
};
var authListeners = [];
var fakeAuthorization = {
  EVT_RELOADED: 'reloaded',
  on: function(ev, cb) { authListeners.push(cb); },
  authorizeStreamingSourceUser: function(u, s) { return (perms[u] || []).indexOf(s) >= 0; },
  getAllowedStreamingSources: function(u) {
    return (perms[u] || []).map(function(s) { return { permissionId: s, name: s }; });
  }
};
var dtmfCalls = [];
var fakeAstProxy = {
  sendDTMFSequence: function(exten, seq, callerid, fromExten, cb) {
    dtmfCalls.push({ exten: exten, seq: seq });
    cb(exten === 'fail' ? 'error' : null);
  }
};
streaming.setCompAuthorization(fakeAuthorization);
streaming.setCompAstProxy(fakeAstProxy);
// no sampling until the sampler test
streaming.setSubscribersChecker(function() { return false; });
assert.strictEqual(authListeners.length, 1, 'listens to the authorization reload');

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'streaming-test-'));
var results = [];
function ok(name) {
  results.push(name);
  console.log('ok - ' + name);
}

function writeConfig(port, gatePort) {
  var cfg = {
    // file written before the feature: no type, no gates
    vs_old: {
      descr: 'Old door', url: 'http://192.168.5.9/snap.jpg', user: 'root', secret: 'legacy-secret',
      'frame-rate': '1000', exten: '301', open: '0*'
    },
    // image source with credentials
    vs_img: {
      descr: 'Image', url: 'http://127.0.0.1:' + port + '/basic.jpg', user: '', secret: '',
      'frame-rate': '1000', exten: '302', open: '5', type: 'image', gateway_path: null,
      image_auth: { username: 'cam', password: 'Img-Secret-9' },
      gates: [{ id: '1', name: 'Door', type: 'dtmf', code: '5' }]
    },
    // rtsp source with a DTMF and an URL gate
    vs_rtsp: {
      descr: 'Ingresso', url: '', user: '', secret: '', 'frame-rate': '1000', exten: null, open: '6',
      type: 'rtsp', gateway_path: 'streaming-gw/vs_rtsp', image_auth: null,
      gates: [
        { id: '1', name: 'Porta', type: 'dtmf', code: '6' },
        { id: '2', name: 'Cancello', type: 'url', url: 'http://127.0.0.1:' + gatePort + '/basic', method: 'GET', username: 'gate', password: 'Gate-Spike-77' },
        { id: '3', name: 'Digest', type: 'url', url: 'http://127.0.0.1:' + gatePort + '/digest', method: 'POST', username: 'gate', password: 'Gate-Spike-77' },
        { id: '4', name: 'Open', type: 'url', url: 'http://127.0.0.1:' + gatePort + '/open', method: 'get', username: '', password: '' },
        { id: '5', name: 'Redirect', type: 'url', url: 'http://127.0.0.1:' + gatePort + '/redirect', method: 'GET', username: '', password: '' },
        { id: '6', name: 'Slow', type: 'url', url: 'http://127.0.0.1:' + gatePort + '/slow', method: 'GET', username: '', password: '' },
        { id: '7', name: 'Broken', type: 'url', url: 'http://127.0.0.1:' + gatePort + '/500', method: 'GET', username: '', password: '' },
        { id: '8', name: 'Wrong password', type: 'url', url: 'http://127.0.0.1:' + gatePort + '/basic', method: 'GET', username: 'gate', password: 'wrong' },
        { type: 'bogus' }
      ]
    },
    // rtsp source without gates and without extension
    vs_rtsp2: {
      descr: 'Ingresso-2', url: '', user: '', secret: '', 'frame-rate': '1000', exten: null, open: '',
      type: 'rtsp', gateway_path: 'streaming-gw/vs_rtsp2', image_auth: null, gates: []
    }
  };
  var file = path.join(tmp, 'streaming.json');
  fs.writeFileSync(file, JSON.stringify(cfg));
  return file;
}

// --- fake devices ---------------------------------------------------------
var deviceCalls = [];
var digestNonce = crypto.randomBytes(8).toString('hex');
function md5(s) { return crypto.createHash('md5').update(s).digest('hex'); }
function checkDigest(req, user, pass) {
  var h = req.headers.authorization || '';
  if (h.indexOf('Digest ') !== 0) { return false; }
  var p = {};
  h.substring(7).replace(/(\w+)=("([^"]*)"|([^,]*))/g, function(m, k, v, q, u) { p[k] = q !== undefined ? q : u; });
  var ha1 = md5(user + ':' + p.realm + ':' + pass);
  var ha2 = md5(req.method + ':' + p.uri);
  var expected = p.qop ? md5([ha1, p.nonce, p.nc, p.cnonce, p.qop, ha2].join(':')) : md5([ha1, p.nonce, ha2].join(':'));
  return p.username === user && p.nonce === digestNonce && p.response === expected;
}
function basicOk(req, user, pass) {
  return req.headers.authorization === 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
}
function deviceHandler(req, res) {
  deviceCalls.push({ method: req.method, url: req.url, auth: (req.headers.authorization || '').split(' ')[0] });
  var u = req.url.split('?')[0];
  if (u === '/basic.jpg' || u === '/basic') {
    if (basicOk(req, u === '/basic' ? 'gate' : 'cam', u === '/basic' ? 'Gate-Spike-77' : 'Img-Secret-9')) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(u === '/basic' ? 'opened' : 'JPEGDATA');
    } else {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="dev"' });
      res.end();
    }
  } else if (u === '/digest.jpg' || u === '/digest') {
    if (checkDigest(req, u === '/digest' ? 'gate' : 'cam', u === '/digest' ? 'Gate-Spike-77' : 'Img-Secret-9')) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end('DIGESTJPEG');
    } else {
      res.writeHead(401, { 'WWW-Authenticate': 'Digest realm="dev", qop="auth", nonce="' + digestNonce + '", opaque="x"' });
      res.end();
    }
  } else if (u === '/nochallenge.jpg') {
    if (basicOk(req, 'cam', 'Img-Secret-9')) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end('PNG');
    } else {
      res.writeHead(401);
      res.end();
    }
  } else if (u === '/open') {
    res.writeHead(204);
    res.end();
  } else if (u === '/redirect') {
    res.writeHead(302, { Location: '/open' });
    res.end();
  } else if (u === '/slow') {
    setTimeout(function() { try { res.writeHead(200); res.end(); } catch (e) {} }, 8000);
  } else {
    res.writeHead(500);
    res.end();
  }
}

// --- fake video gateway API -------------------------------------------------
var gwSessions = [];
var gwKicked = [];
function gatewayHandler(req, res) {
  if (req.method === 'GET' && req.url.indexOf('/v3/webrtcsessions/list') === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ itemCount: gwSessions.length, pageCount: 1, items: gwSessions }));
  } else if (req.method === 'POST' && req.url.indexOf('/v3/webrtcsessions/kick/') === 0) {
    var id = decodeURIComponent(req.url.substring('/v3/webrtcsessions/kick/'.length));
    var found = gwSessions.filter(function(s) { return s.id === id; }).length > 0;
    gwSessions = gwSessions.filter(function(s) { return s.id !== id; });
    if (found) { gwKicked.push(id); }
    res.writeHead(found ? 200 : 404);
    res.end();
  } else {
    res.writeHead(404);
    res.end();
  }
}

function listen(handler, cb) {
  var srv = http.createServer(handler);
  srv.listen(0, '127.0.0.1', function() { cb(srv, srv.address().port); });
}
function p(fn) {
  return new Promise(function(resolve) { fn(function() { resolve([].slice.call(arguments)); }); });
}
function hook(body) {
  return streaming.authorizeGatewayReader(body);
}

async function main() {
  var dev = await p(function(cb) { listen(deviceHandler, cb); });
  var gw = await p(function(cb) { listen(gatewayHandler, cb); });
  var devPort = dev[1];
  var gwPort = gw[1];
  var cfgFile = writeConfig(devPort, devPort);
  var services = path.join(tmp, 'services.json');

  // --- configuration -------------------------------------------------------
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: '' } }));
  streaming.configGateway(services);
  assert(logs.some(function(l) { return l.indexOf('not configured') >= 0; }));
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: String(gwPort) } }));
  streaming.configGateway(services);
  streaming.config(cfgFile);

  var all = await p(function(cb) { streaming.getAllStreamingSources('alice', cb); });
  assert.strictEqual(all[0], null);
  var src = all[1];
  assert.deepStrictEqual(Object.keys(src).sort(), ['vs_img', 'vs_old', 'vs_rtsp', 'vs_rtsp2']);
  var keys = ['id', 'url', 'user', 'cmdOpen', 'password', 'frameRate', 'extension', 'description', 'type', 'whep', 'gates'];
  Object.keys(src).forEach(function(k) {
    assert.deepStrictEqual(Object.keys(src[k]), keys, 'same keys for ' + k);
    assert.strictEqual(src[k].url, '');
    assert.strictEqual(src[k].user, '');
    assert.strictEqual(src[k].password, '');
  });
  assert.strictEqual(src.vs_old.type, 'image');
  assert.strictEqual(src.vs_old.whep, null);
  assert.deepStrictEqual(src.vs_old.gates, []);
  assert.strictEqual(src.vs_old.cmdOpen, '0*');
  assert.strictEqual(src.vs_img.type, 'image');
  assert.deepStrictEqual(src.vs_img.gates, [{ id: '1', name: 'Door', type: 'dtmf' }]);
  assert.strictEqual(src.vs_rtsp.type, 'rtsp');
  assert.strictEqual(src.vs_rtsp.whep, '/streaming-gw/vs_rtsp/whep');
  assert.strictEqual(src.vs_rtsp.gates.length, 8, 'malformed gate skipped');
  src.vs_rtsp.gates.forEach(function(g) { assert.deepStrictEqual(Object.keys(g), ['id', 'name', 'type']); });
  var bobSrc = (await p(function(cb) { streaming.getAllStreamingSources('bob', cb); }))[1];
  assert.deepStrictEqual(Object.keys(bobSrc), ['vs_img']);
  ok('config parsing of old/image/rtsp variants and sanitized sources');

  // every client-facing payload: REST sources, call events, JSON serialization
  var payloads = [JSON.stringify(src), JSON.stringify(streaming.getSourceJSONByExten('301')),
    JSON.stringify(streaming.getSourceJSONByExten('302'))];
  payloads.forEach(function(pl) {
    SECRETS.concat(['192.168.5.9', '127.0.0.1:' + devPort, 'gate"', '"code"', 'image_auth']).forEach(function(sec) {
      assert(pl.indexOf(sec) < 0, 'payload leaks ' + sec + ': ' + pl);
    });
  });
  assert.strictEqual(streaming.getSourceJSONByExten('301').id, 'vs_old');
  ok('no device address nor credential in client payloads');

  // --- tokens ----------------------------------------------------------------
  var r = await p(function(cb) { streaming.createStreamToken('alice', 'vs_img', cb); });
  assert.strictEqual(r[0].status, 400);
  assert.strictEqual(r[0].code, 'not_rtsp_source');
  r = await p(function(cb) { streaming.createStreamToken('alice', 'vs_nope', cb); });
  assert.strictEqual(r[0].status, 404);
  r = await p(function(cb) { streaming.createStreamToken('alice', 'vs_rtsp', cb); });
  assert.strictEqual(r[0], null);
  var tok = r[1];
  assert.deepStrictEqual(Object.keys(tok), ['token', 'expires_in', 'whep']);
  assert(/^[0-9a-f]{64}$/.test(tok.token));
  assert.strictEqual(tok.expires_in, 60);
  assert.strictEqual(tok.whep, '/streaming-gw/vs_rtsp/whep');
  var tok2 = (await p(function(cb) { streaming.createStreamToken('alice', 'vs_rtsp', cb); }))[1];
  assert.notStrictEqual(tok.token, tok2.token);
  ok('token creation');

  // --- hook decisions --------------------------------------------------------
  var base = {
    ip: '127.0.0.1', user: '', password: '', token: tok.token, action: 'read',
    path: 'streaming-gw/vs_rtsp', protocol: 'webrtc', id: 'sess-1', query: '', userAgent: 'x'
  };
  function withField(k, v) { var o = JSON.parse(JSON.stringify(base)); o[k] = v; return o; }
  var d = hook(base);
  assert.strictEqual(d.allow, true);
  assert.strictEqual(d.username, 'alice');
  assert.strictEqual(hook(withField('id', 'sess-1b')).allow, true, 'token reusable');
  assert.strictEqual(hook(withField('action', 'publish')).allow, false);
  assert.strictEqual(hook(withField('action', 'playback')).allow, false);
  assert.strictEqual(hook(withField('action', 'api')).allow, false);
  assert.strictEqual(hook(withField('protocol', 'rtsp')).allow, false, 'local RTSP readers denied');
  assert.strictEqual(hook(withField('protocol', 'hls')).allow, false);
  assert.strictEqual(hook(withField('path', 'streaming-gw/vs_rtsp2')).reason, 'token not valid for this source');
  assert.strictEqual(hook(withField('path', 'streaming-gw/vs_img')).reason, 'unknown path');
  assert.strictEqual(hook(withField('path', 'streaming-gw/vs_nope')).reason, 'unknown path');
  assert.strictEqual(hook(withField('path', 'vs_rtsp')).reason, 'unknown path');
  assert.strictEqual(hook(withField('path', '')).reason, 'unknown path');
  assert.strictEqual(hook(withField('id', '')).reason, 'missing session id');
  assert.strictEqual(hook(withField('token', '')).reason, 'missing token');
  assert.strictEqual(hook(withField('token', 'x' + tok.token)).reason, 'invalid or expired token');
  assert.strictEqual(hook(withField('token', '__proto__')).reason, 'invalid or expired token');
  assert.strictEqual(hook(withField('token', 'constructor')).reason, 'invalid or expired token');
  var q = withField('token', '');
  q.query = 'token=' + tok.token;
  q.id = 'sess-q';
  assert.strictEqual(hook(q).allow, true, 'token from the query string');
  q.query = 'foo=1&token=' + tok.token + '&bar=2';
  assert.strictEqual(hook(q).allow, true);
  var basic = withField('token', tok.token);
  basic.user = 'whatever';
  basic.password = tok.token;
  basic.id = 'sess-basic';
  assert.strictEqual(hook(basic).allow, true, 'basic auth password copied in token');
  assert.strictEqual(hook(null).allow, false);
  assert.strictEqual(hook([]).allow, false);
  assert.strictEqual(hook('x').allow, false);
  // permission lost
  perms.alice = ['vs_img', 'vs_old', 'vs_rtsp2'];
  assert.strictEqual(hook(withField('id', 'sess-x')).reason, 'permission denied');
  perms.alice = ['vs_rtsp', 'vs_img', 'vs_old', 'vs_rtsp2'];
  // expiry
  var realNow = Date.now;
  Date.now = function() { return realNow() + 61000; };
  assert.strictEqual(hook(withField('id', 'sess-late')).reason, 'invalid or expired token');
  Date.now = realNow;
  assert.strictEqual(hook(withField('token', tok2.token)).allow, true, 'other token still valid');
  // a token of bob (no permission) cannot exist: the REST layer checks it, but
  // the hook re-checks the permission anyway
  var tb = (await p(function(cb) { streaming.createStreamToken('bob', 'vs_rtsp', cb); }))[1];
  assert.strictEqual(hook(withField('token', tb.token)).reason, 'permission denied');
  assert(logs.join('\n').indexOf(tok.token) < 0, 'token never logged');
  ok('hook decisions');

  // per user token limit
  var many = [];
  for (var i = 0; i < 25; i++) {
    many.push((await p(function(cb) { streaming.createStreamToken('alice', 'vs_rtsp2', cb); }))[1].token);
  }
  assert.strictEqual(hook({ action: 'read', protocol: 'webrtc', path: 'streaming-gw/vs_rtsp2', id: 's-l', token: many[0] }).allow, false, 'oldest token dropped');
  assert.strictEqual(hook({ action: 'read', protocol: 'webrtc', path: 'streaming-gw/vs_rtsp2', id: 's-l', token: many[24] }).allow, true);
  ok('per user token limit');

  // --- revocation --------------------------------------------------------------
  var now = new Date().toISOString();
  var old = new Date(Date.now() - 60000).toISOString();
  gwSessions = [
    { id: 'sess-1', created: now, path: 'streaming-gw/vs_rtsp' },
    { id: 'sess-q', created: now, path: 'streaming-gw/vs_rtsp' },
    { id: 'sess-l', created: now, path: 'streaming-gw/vs_rtsp2' },
    { id: 'unknown-new', created: now, path: 'streaming-gw/vs_rtsp' },
    { id: 'unknown-old', created: old, path: 'streaming-gw/vs_rtsp' }
  ];
  hook({ action: 'read', protocol: 'webrtc', path: 'streaming-gw/vs_rtsp2', id: 'sess-l', token: many[24] });
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert.deepStrictEqual(gwKicked, ['unknown-old'], 'only the old unknown session is kicked');
  // alice loses vs_rtsp: her sessions on it are kicked, her tokens dropped
  perms.alice = ['vs_img', 'vs_old', 'vs_rtsp2'];
  authListeners[0]();
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert.deepStrictEqual(gwKicked.slice(1).sort(), ['sess-1', 'sess-q']);
  perms.alice = ['vs_rtsp', 'vs_img', 'vs_old', 'vs_rtsp2'];
  assert.strictEqual(hook(withField('id', 'sess-again')).reason, 'invalid or expired token', 'token dropped on revocation');
  // source removed by a reload
  var cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  delete cfg.vs_rtsp2;
  fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  streaming.reload();
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert(gwKicked.indexOf('sess-l') >= 0, 'session of the removed source kicked');
  assert(logs.some(function(l) { return l.indexOf('source removed') >= 0; }));
  // gateway down: logged once, no exception
  var before = logs.filter(function(l) { return l.indexOf('listing video gateway sessions') >= 0; }).length;
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: '1' } }));
  streaming.configGateway(services);
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert.strictEqual(logs.filter(function(l) { return l.indexOf('listing video gateway sessions') >= 0; }).length, before + 1);
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: String(gwPort) } }));
  streaming.configGateway(services);
  ok('revocation and reconciliation');

  // --- gates -----------------------------------------------------------------
  streaming.config(writeConfig(devPort, devPort));
  function open(id, gate) {
    return p(function(cb) { streaming.openGate(id, gate, '"alice" <201>', '201', 'alice', cb); });
  }
  dtmfCalls = [];
  r = await open('vs_old');
  assert.strictEqual(r[0], null);
  assert.deepStrictEqual(dtmfCalls, [{ exten: '301', seq: '0*' }], 'legacy open code');
  r = await open('vs_old', '1');
  assert.strictEqual(r[0].status, 404, 'legacy source has no gate ids');
  r = await open('vs_img');
  assert.strictEqual(r[0], null);
  assert.deepStrictEqual(dtmfCalls[1], { exten: '302', seq: '5' }, 'first gate by default');
  r = await open('vs_rtsp');
  assert.strictEqual(r[0].status, 400);
  assert.strictEqual(r[0].code, 'no_extension', 'DTMF gate without extension');
  r = await open('vs_rtsp2');
  assert.strictEqual(r[0].code, 'no_gates');
  r = await open('vs_rtsp', '99');
  assert.strictEqual(r[0].code, 'gate_not_found');
  r = await open('vs_nope');
  assert.strictEqual(r[0].code, 'source_not_found');
  deviceCalls = [];
  r = await open('vs_rtsp', '2');
  assert.strictEqual(r[0], null, 'basic URL gate');
  assert.deepStrictEqual(deviceCalls.map(function(c) { return c.auth; }), ['', 'Basic']);
  deviceCalls = [];
  r = await open('vs_rtsp', '2');
  assert.strictEqual(r[0], null);
  assert.deepStrictEqual(deviceCalls.map(function(c) { return c.auth; }), ['Basic'], 'basic remembered');
  deviceCalls = [];
  r = await open('vs_rtsp', '3');
  assert.strictEqual(r[0], null, 'digest URL gate');
  assert.deepStrictEqual(deviceCalls.map(function(c) { return c.method + ' ' + c.auth; }), ['POST ', 'POST Digest']);
  r = await open('vs_rtsp', '4');
  assert.strictEqual(r[0], null, 'no auth, 204, lower case method');
  r = await open('vs_rtsp', '5');
  assert.strictEqual(r[0].code, 'gate_failed', 'redirect not followed');
  assert.strictEqual(r[0].deviceStatus, 302);
  r = await open('vs_rtsp', '7');
  assert.strictEqual(r[0].code, 'gate_failed');
  r = await open('vs_rtsp', '8');
  assert.strictEqual(r[0].status, 502);
  assert.strictEqual(r[0].deviceStatus, 401, 'wrong password');
  var t0 = Date.now();
  r = await open('vs_rtsp', '6');
  assert.strictEqual(r[0].code, 'gate_timeout');
  assert(Date.now() - t0 < 6000 && Date.now() - t0 >= 4900, 'timeout ~5 s');
  r = await p(function(cb) { streaming.open('vs_img', '"alice" <201>', '201', cb); });
  assert.strictEqual(r[0], null, 'old open() signature');
  SECRETS.forEach(function(sec) { assert(logs.join('\n').indexOf(sec) < 0, 'log leaks ' + sec); });
  ok('gates: selection, fallbacks, DTMF, URL with Basic/Digest/timeout/redirect');

  // --- snapshots --------------------------------------------------------------
  r = await p(function(cb) { streaming.getVideoSample('vs_img', cb); });
  assert.strictEqual(r[0], null);
  assert.strictEqual(r[1], 'data:image/jpeg;base64,' + Buffer.from('JPEGDATA').toString('base64'));
  r = await p(function(cb) { streaming.getVideoSample('vs_rtsp', cb); });
  assert.strictEqual(r[0].code, 'not_image_source');
  var Streaming = require('../streaming_class').Streaming;
  var dig = new Streaming({ id: 'd', url: 'http://127.0.0.1:' + devPort + '/digest.jpg', type: 'image', image_auth: { username: 'cam', password: 'Img-Secret-9' } });
  deviceCalls = [];
  r = await p(function(cb) { dig.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0], null);
  assert.strictEqual(r[1], 'data:image/jpeg;base64,' + Buffer.from('DIGESTJPEG').toString('base64'));
  assert.deepStrictEqual(deviceCalls.map(function(c) { return c.auth; }), ['', 'Digest']);
  var noch = new Streaming({ id: 'n', url: 'http://127.0.0.1:' + devPort + '/nochallenge.jpg', type: 'image', image_auth: { username: 'cam', password: 'Img-Secret-9' } });
  r = await p(function(cb) { noch.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0], null, '401 without challenge falls back to preemptive Basic');
  var legacy = new Streaming({ id: 'l', url: 'http://127.0.0.1:' + devPort + '/basic.jpg', user: 'cam', secret: 'Img-Secret-9' });
  r = await p(function(cb) { legacy.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0], null, 'legacy user/secret used for the snapshot');
  var noauth = new Streaming({ id: 'x', url: 'http://127.0.0.1:' + devPort + '/basic.jpg', type: 'image', image_auth: null });
  r = await p(function(cb) { noauth.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0], 'HTTP status 401');
  // the sampler does not touch rtsp sources
  var sampled = [];
  streaming.setSubscribersChecker(function(id) { sampled.push(id); return false; });
  streaming.start();
  await new Promise(function(resolve) { setTimeout(resolve, 1200); });
  streaming.reload();
  assert(sampled.length > 0);
  assert(sampled.every(function(id) { return id === 'vs_old' || id === 'vs_img'; }), 'rtsp sources not sampled: ' + sampled);
  ok('authenticated snapshots and no sampling of rtsp sources');

  // --- TLS certificate verification -----------------------------------------
  // a device with a self-signed certificate, generated for this run only
  var keyFile = path.join(tmp, 'device.key');
  var certFile = path.join(tmp, 'device.crt');
  childProcess.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=door.example', '-keyout', keyFile, '-out', certFile], { stdio: 'ignore' });
  var tlsSrv = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, deviceHandler);
  await new Promise(function(resolve) { tlsSrv.listen(0, '127.0.0.1', resolve); });
  var tlsBase = 'https://127.0.0.1:' + tlsSrv.address().port;
  function tlsSource(descr, skip) {
    var s = {
      descr: descr, url: tlsBase + '/basic.jpg', user: '', secret: '', 'frame-rate': '1000', exten: null, open: '',
      type: 'image', gateway_path: null, image_auth: { username: 'cam', password: 'Img-Secret-9' },
      gates: [{ id: '1', name: 'Gate', type: 'url', url: tlsBase + '/basic', method: 'GET', username: 'gate', password: 'Gate-Spike-77' }]
    };
    if (skip !== undefined) {
      s.tls_skip_verify = skip;
    }
    return s;
  }
  var tlsCfg = path.join(tmp, 'streaming-tls.json');
  fs.writeFileSync(tlsCfg, JSON.stringify({
    vs_tls_absent: tlsSource('No key'),
    vs_tls_off: tlsSource('Off', false),
    vs_tls_string: tlsSource('String', 'true'),
    vs_tls_on: tlsSource('On', true)
  }));
  streaming.config(tlsCfg);
  logs = [];
  deviceCalls = [];
  var sources = ['vs_tls_absent', 'vs_tls_off', 'vs_tls_string'];
  for (i = 0; i < sources.length; i++) {
    r = await p(function(cb) { streaming.getVideoSample(sources[i], cb); });
    assert(r[0] && r[0].code === 'DEPTH_ZERO_SELF_SIGNED_CERT', sources[i] + ': snapshot verified: ' + (r[0] && r[0].code));
    r = await open(sources[i], '1');
    assert.strictEqual(r[0].status, 502, sources[i] + ': gate verified');
    assert.strictEqual(r[0].code, 'gate_unreachable');
    assert.strictEqual(r[0].message, 'the TLS certificate of the gate device is not valid');
  }
  assert.strictEqual(deviceCalls.length, 0, 'nothing sent to an untrusted device');
  assert(logs.some(function(l) { return l.indexOf('failed to open gate "1"') >= 0 && l.indexOf('DEPTH_ZERO_SELF_SIGNED_CERT') >= 0 && l.indexOf('Skip TLS certificate verification') >= 0; }), 'gate TLS error logged');
  assert(logs.some(function(l) { return l.indexOf('getting video sample') >= 0 && l.indexOf('DEPTH_ZERO_SELF_SIGNED_CERT') >= 0; }), 'snapshot TLS error logged');
  r = await p(function(cb) { streaming.getVideoSample('vs_tls_on', cb); });
  assert.strictEqual(r[0], null, 'snapshot with tls_skip_verify');
  assert.strictEqual(r[1], 'data:image/jpeg;base64,' + Buffer.from('JPEGDATA').toString('base64'));
  r = await open('vs_tls_on', '1');
  assert.strictEqual(r[0], null, 'gate with tls_skip_verify');
  assert.deepStrictEqual(deviceCalls.map(function(c) { return c.url + ' ' + c.auth; }),
    ['/basic.jpg ', '/basic.jpg Basic', '/basic ', '/basic Basic']);
  // the skip of a source never leaks to the others (pooled connections)
  r = await p(function(cb) { streaming.getVideoSample('vs_tls_off', cb); });
  assert.strictEqual(r[0] && r[0].code, 'DEPTH_ZERO_SELF_SIGNED_CERT', 'other source still verified');
  r = await open('vs_tls_off', '1');
  assert.strictEqual(r[0].message, 'the TLS certificate of the gate device is not valid');
  assert.strictEqual(new Streaming({ id: 'a', url: 'https://x' }).getTlsSkipVerify(), false);
  assert.strictEqual(new Streaming({ id: 'b', url: 'https://x', tls_skip_verify: 1 }).getTlsSkipVerify(), false);
  assert.strictEqual(new Streaming({ id: 'c', url: 'https://x', tls_skip_verify: true }).getTlsSkipVerify(), true);
  assert(JSON.stringify(streaming.getSourceJSONByExten('302')).indexOf('tls') < 0);
  SECRETS.forEach(function(sec) { assert(logs.join('\n').indexOf(sec) < 0, 'log leaks ' + sec); });
  tlsSrv.close();
  ok('TLS certificate verified by default, skipped only for the sources with tls_skip_verify');

  dev[0].close();
  gw[0].close();
  fs.rmSync ? fs.rmSync(tmp, { recursive: true }) : null;
  console.log('\n' + results.length + ' groups passed');
  process.exit(0);
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
