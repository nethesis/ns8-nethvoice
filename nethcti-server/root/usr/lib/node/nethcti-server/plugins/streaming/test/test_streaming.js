/**
 * Tests of the streaming component: configuration parsing, data sent to the
 * clients, stream tokens, video gateway authentication hook, sessions
 * revocation, session limits, gates, authenticated snapshots, the per source
 * TLS certificate verification and pinning (self-signed devices, needs the
 * openssl command), the refusal of loopback devices and the response limits.
 *
 * The fake devices listen on a non-loopback address of the host (loopback
 * devices are refused): the host needs one (e.g. the eth0 of a container).
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

var SECRETS = ['Door-Spike-42', 'Gate-Spike-77', 'Img-Secret-9', 'legacy-secret', 'Api-Secret-55'];
var API_PASSWORD = 'Api-Secret-55';

// a non-loopback address of this host for the fake devices
var DEV_HOST = (function() {
  var ifaces = os.networkInterfaces();
  var n, i;
  for (n in ifaces) {
    for (i = 0; i < ifaces[n].length; i++) {
      if (ifaces[n][i].family === 'IPv4' && !ifaces[n][i].internal) {
        return ifaces[n][i].address;
      }
    }
  }
  throw new Error('the tests need a non-loopback IPv4 address');
})();

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
// conversations of the extensions as returned by astproxy getJSONExtension()
var extenConvs = {};
function fakeConv(exten, status, incoming) {
  // incoming: the extension is called (e.g. by the gate opening originate),
  // otherwise it is the caller (the intercom calling a user)
  var mine = { channel: 'PJSIP/' + exten + '-0000002a', channelStatus: status };
  var other = { channel: 'PJSIP/204-0000002b', channelStatus: status === 'up' ? 'up' : (incoming ? 'ring' : 'ringing') };
  var c = incoming ? { chSource: other, chDest: mine } : { chSource: mine, chDest: other };
  var r = {};
  r[c.chSource.channel + '>' + c.chDest.channel] = c;
  return r;
}
var fakeAstProxy = {
  isExten: function(exten) { return exten === '301' || exten === '302'; },
  getJSONExtension: function(exten) {
    return { exten: exten, conversations: extenConvs[exten] || {} };
  },
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
      descr: 'Image', url: 'http://' + DEV_HOST + ':' + port + '/basic.jpg', user: '', secret: '',
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
        { id: '2', name: 'Cancello', type: 'url', url: 'http://' + DEV_HOST + ':' + gatePort + '/basic', method: 'GET', username: 'gate', password: 'Gate-Spike-77' },
        { id: '3', name: 'Digest', type: 'url', url: 'http://' + DEV_HOST + ':' + gatePort + '/digest', method: 'POST', username: 'gate', password: 'Gate-Spike-77' },
        { id: '4', name: 'Open', type: 'url', url: 'http://' + DEV_HOST + ':' + gatePort + '/open', method: 'get', username: '', password: '' },
        { id: '5', name: 'Redirect', type: 'url', url: 'http://' + DEV_HOST + ':' + gatePort + '/redirect', method: 'GET', username: '', password: '' },
        { id: '6', name: 'Slow', type: 'url', url: 'http://' + DEV_HOST + ':' + gatePort + '/slow', method: 'GET', username: '', password: '' },
        { id: '7', name: 'Broken', type: 'url', url: 'http://' + DEV_HOST + ':' + gatePort + '/500', method: 'GET', username: '', password: '' },
        { id: '8', name: 'Wrong password', type: 'url', url: 'http://' + DEV_HOST + ':' + gatePort + '/basic', method: 'GET', username: 'gate', password: 'wrong' },
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
  } else if (u === '/big.jpg' || u === '/big') {
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(Buffer.alloc(u === '/big' ? 70 * 1024 : 6 * 1024 * 1024, 1));
  } else if (u === '/bigchunked.jpg') {
    // no content-length: the limit is checked on the received data
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    var chunks = 0;
    var timer = setInterval(function() {
      chunks += 1;
      if (chunks > 8 || res.write(Buffer.alloc(1024 * 1024, 2)) === null) {
        clearInterval(timer);
        try { res.end(); } catch (e) {}
      }
    }, 10);
    res.on('close', function() { clearInterval(timer); });
  } else if (u === '/redirect.jpg') {
    res.writeHead(302, { Location: 'http://' + DEV_HOST + ':' + req.socket.localPort + '/basic.jpg' });
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
var gwUnauthorized = 0;
function gatewayHandler(req, res) {
  if (req.headers.authorization !== 'Basic ' + Buffer.from('nethcti-server:' + API_PASSWORD).toString('base64')) {
    gwUnauthorized += 1;
    res.writeHead(401);
    res.end();
    return;
  }
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

function listen(handler, cb, address) {
  var srv = http.createServer(handler);
  srv.listen(0, address || '127.0.0.1', function() { cb(srv, srv.address().port); });
}
function p(fn) {
  return new Promise(function(resolve) { fn(function() { resolve([].slice.call(arguments)); }); });
}
var i;
function hook(body) {
  return streaming.authorizeGatewayReader(body);
}

async function main() {
  var dev = await p(function(cb) { listen(deviceHandler, cb, '0.0.0.0'); });
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
  assert(logs.some(function(l) { return l.indexOf('API password not configured') >= 0; }), 'no API without password');
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: String(gwPort), api_password: API_PASSWORD } }));
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
  assert.strictEqual(src.vs_old.cmdOpen, '0*', 'DTMF code only for the configurations without gates');
  // sources with gates: a placeholder, never the code, for the button of the older clients
  assert.strictEqual(src.vs_img.cmdOpen, '*', 'no DTMF code for the sources with gates');
  assert.strictEqual(src.vs_rtsp.cmdOpen, '*');
  assert.strictEqual(src.vs_rtsp2.cmdOpen, '', 'no gates: no open door button');
  assert.strictEqual(streaming.getSourceJSONByExten('302').cmdOpen, '*');
  [src.vs_img, src.vs_rtsp].forEach(function(s) { assert.notStrictEqual(s.cmdOpen, '5'); assert.notStrictEqual(s.cmdOpen, '6'); });
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
    SECRETS.concat(['192.168.5.9', DEV_HOST + ':' + devPort, 'gate"', '"code"', 'image_auth']).forEach(function(sec) {
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
  // used later for a session beyond the limit
  var tokenBeforeLimit = (await p(function(cb) { streaming.createStreamToken('alice', 'vs_rtsp', cb); }))[1].token;
  ok('token creation');

  // --- hook decisions --------------------------------------------------------
  function newToken(user, source) {
    return p(function(cb) { streaming.createStreamToken(user, source, cb); }).then(function(r) { return r[1].token; });
  }
  var base = {
    ip: '127.0.0.1', user: '', password: '', token: tok.token, action: 'read',
    path: 'streaming-gw/vs_rtsp', protocol: 'webrtc', id: 'sess-1', query: '', userAgent: 'x'
  };
  function withField(k, v) { var o = JSON.parse(JSON.stringify(base)); o[k] = v; return o; }
  // denials do not consume the token
  assert.strictEqual(hook(withField('action', 'publish')).allow, false);
  assert.strictEqual(hook(withField('action', 'playback')).allow, false);
  assert.strictEqual(hook(withField('action', 'metrics')).allow, false);
  assert.strictEqual(hook(withField('action', 'pprof')).allow, false);
  assert.strictEqual(hook(withField('protocol', 'rtsp')).allow, false, 'local RTSP readers denied');
  assert.strictEqual(hook(withField('protocol', 'hls')).allow, false);
  assert.strictEqual(hook(withField('path', 'streaming-gw/vs_rtsp2')).reason, 'token not valid for this source');
  assert.strictEqual(hook(withField('path', 'streaming-gw/vs_img')).reason, 'unknown path');
  assert.strictEqual(hook(withField('path', 'streaming-gw/vs_nope')).reason, 'unknown path');
  assert.strictEqual(hook(withField('path', 'vs_rtsp')).reason, 'unknown path');
  assert.strictEqual(hook(withField('path', '')).reason, 'unknown path');
  assert.strictEqual(hook(withField('id', '')).reason, 'missing session id');
  assert.strictEqual(hook(withField('id', null)).reason, 'missing session id', 'request outside a session (OPTIONS)');
  assert.strictEqual(hook(withField('token', '')).reason, 'missing token');
  assert.strictEqual(hook(withField('token', 'x' + tok.token)).reason, 'invalid or expired token');
  assert.strictEqual(hook(withField('token', '__proto__')).reason, 'invalid or expired token');
  assert.strictEqual(hook(withField('token', 'constructor')).reason, 'invalid or expired token');
  // the query string is never read
  var q = withField('token', '');
  q.query = 'token=' + tok.token;
  q.id = 'sess-q';
  assert.strictEqual(hook(q).reason, 'missing token', 'token in the query string ignored');
  assert.strictEqual(hook(null).allow, false);
  assert.strictEqual(hook([]).allow, false);
  assert.strictEqual(hook('x').allow, false);
  // permission lost
  perms.alice = ['vs_img', 'vs_old', 'vs_rtsp2'];
  assert.strictEqual(hook(withField('id', 'sess-x')).reason, 'permission denied');
  perms.alice = ['vs_rtsp', 'vs_img', 'vs_old', 'vs_rtsp2'];
  // single use: bound to the first session
  var d = hook(base);
  assert.strictEqual(d.allow, true);
  assert.strictEqual(d.username, 'alice');
  assert.strictEqual(hook(base).allow, true, 'the same session can be authorized again');
  d = hook(withField('id', 'sess-1b'));
  assert.strictEqual(d.allow, false, 'token not reusable');
  assert.strictEqual(d.reason, 'token already used');
  assert.strictEqual(d.code, 'token_used');
  // MediaMTX copies the Basic password in "token": same rules
  var basic = withField('token', tok2.token);
  basic.user = 'whatever';
  basic.password = tok2.token;
  basic.id = 'sess-basic';
  assert.strictEqual(hook(basic).allow, true, 'basic auth password copied in token');
  // expiry
  var tok3 = await newToken('alice', 'vs_rtsp');
  var realNow = Date.now;
  Date.now = function() { return realNow() + 61000; };
  assert.strictEqual(hook(withField('token', tok3)).reason, 'invalid or expired token');
  Date.now = realNow;
  // a token of bob (no permission) cannot exist: the REST layer checks it, but
  // the hook re-checks the permission anyway
  var tb = (await p(function(cb) { streaming.createStreamToken('bob', 'vs_rtsp', cb); }))[1];
  assert.strictEqual(hook(withField('token', tb.token)).reason, 'permission denied');
  assert(logs.join('\n').indexOf(tok.token) < 0, 'token never logged');
  ok('hook decisions, single use tokens, header only');

  // --- control API: only the internal user with the password ------------------
  var api = { ip: '127.0.0.1', user: 'nethcti-server', password: API_PASSWORD, token: API_PASSWORD, action: 'api', path: '', protocol: '', id: null, query: '' };
  function apiWith(k, v) { var o = JSON.parse(JSON.stringify(api)); o[k] = v; return o; }
  assert.strictEqual(hook(api).allow, true, 'API user allowed');
  assert.strictEqual(hook(apiWith('password', '')).allow, false, 'no password');
  assert.strictEqual(hook(apiWith('password', API_PASSWORD + 'x')).allow, false, 'wrong password');
  assert.strictEqual(hook(apiWith('password', API_PASSWORD.substring(1))).allow, false, 'shorter password');
  assert.strictEqual(hook(apiWith('user', 'nobody')).allow, false, 'other user');
  assert.strictEqual(hook(apiWith('user', '')).allow, false, 'anonymous');
  assert.strictEqual(hook(apiWith('password', tok2.token)).allow, false, 'a stream token is not an API password');
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: String(gwPort) } }));
  streaming.configGateway(services);
  assert.strictEqual(hook(api).allow, false, 'API denied without a configured password');
  assert.strictEqual(hook(apiWith('password', '')).allow, false);
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: String(gwPort), api_password: API_PASSWORD } }));
  streaming.configGateway(services);
  SECRETS.forEach(function(sec) { assert(logs.join('\n').indexOf(sec) < 0, 'log leaks ' + sec); });
  ok('control API allowed only to the internal user');

  // --- session limits ---------------------------------------------------------
  // alice already has sess-1 and sess-basic on vs_rtsp (listed by the gateway)
  var nowIso = new Date().toISOString();
  gwSessions = [{ id: 'sess-1', created: nowIso }, { id: 'sess-basic', created: nowIso }];
  var t4 = await newToken('alice', 'vs_rtsp');
  assert.strictEqual(hook(withField('token', t4)).allow, false, 'sess-1 is bound to another token');
  d = hook(Object.assign(withField('token', t4), { id: 'sess-3' }));
  assert.strictEqual(d.allow, true, 'third session on the source');
  gwSessions.push({ id: 'sess-3', created: nowIso });
  r = await p(function(cb) { streaming.createStreamToken('alice', 'vs_rtsp', cb); });
  assert.strictEqual(r[0].status, 429, 'no token beyond 3 sessions on a source');
  assert.strictEqual(r[0].code, 'too_many_sessions');
  assert(/max 3/.test(r[0].message));
  // a token taken before the limit was reached is refused by the hook
  var t5 = tokenBeforeLimit;
  d = await p(function(cb) { streaming.authorizeGatewayRequest(Object.assign(withField('token', t5), { id: 'sess-4' }), cb); });
  d = d[0];
  assert.strictEqual(d.allow, false, 'fourth session on the source denied');
  assert.strictEqual(d.code, 'too_many_sessions');
  assert(logs.some(function(l) { return l.indexOf('too many sessions on this source') >= 0; }), 'limit logged');
  // a session closed meanwhile (not listed any more) frees a slot
  gwSessions = gwSessions.filter(function(x) { return x.id !== 'sess-basic'; });
  var realNow2 = Date.now;
  Date.now = function() { return realNow2() + 6000; }; // older than the record grace
  d = (await p(function(cb) { streaming.authorizeGatewayRequest(Object.assign(withField('token', t5), { id: 'sess-4' }), cb); }))[0];
  Date.now = realNow2;
  assert.strictEqual(d.allow, true, 'slot freed by the closed session');
  // other sources are not affected
  var tts = [];
  for (i = 0; i < 4; i++) {
    tts.push(await newToken('alice', 'vs_rtsp2'));
  }
  for (i = 0; i < 4; i++) {
    var dd = hook({ action: 'read', protocol: 'webrtc', path: 'streaming-gw/vs_rtsp2', id: 'm-' + i, token: tts[i] });
    if (i < 3) {
      assert.strictEqual(dd.allow, true, 'session ' + i + ' on vs_rtsp2');
    } else {
      assert.strictEqual(dd.code, 'too_many_sessions');
    }
  }
  // total limit: 11 sources, 3 sessions each
  var many = {};
  for (i = 0; i < 11; i++) {
    many['vs_s' + i] = { descr: 'S' + i, url: '', type: 'rtsp', gateway_path: 'streaming-gw/vs_s' + i, gates: [] };
  }
  var manyFile = path.join(tmp, 'streaming-many.json');
  fs.writeFileSync(manyFile, JSON.stringify(many));
  streaming.config(manyFile);
  perms.erin = Object.keys(many);
  var allowed = 0;
  var lastDenied = null;
  for (i = 0; i < 11; i++) {
    for (var j = 0; j < 3; j++) {
      r = await p(function(cb) { streaming.createStreamToken('erin', 'vs_s' + i, cb); });
      if (r[0]) {
        lastDenied = r[0];
        continue;
      }
      if (hook({ action: 'read', protocol: 'webrtc', path: 'streaming-gw/vs_s' + i, id: 'e-' + i + '-' + j, token: r[1].token }).allow) {
        allowed += 1;
      }
    }
  }
  assert.strictEqual(allowed, 30, 'at most 30 sessions per user');
  assert.strictEqual(lastDenied.code, 'too_many_sessions');
  assert(/of the user \(30, max 30\)/.test(lastDenied.message), lastDenied.message);
  streaming.config(cfgFile);
  ok('session limits per source and per user, refreshed from the gateway');

  // --- token rate limit ---------------------------------------------------------
  var limited = null;
  for (i = 0; i < 400 && limited === null; i++) {
    r = await p(function(cb) { streaming.createStreamToken('carol', 'vs_rtsp', cb); });
    if (r[0] && r[0].code === 'too_many_requests') {
      limited = i;
    }
  }
  assert.strictEqual(limited, 300, 'rate limited after 300 tokens in a minute');
  assert.strictEqual(r[0].status, 429);
  Date.now = function() { return realNow2() + 61000; };
  r = await p(function(cb) { streaming.createStreamToken('carol', 'vs_rtsp', cb); });
  Date.now = realNow2;
  assert.strictEqual(r[0], null, 'allowed again after the window');
  r = await p(function(cb) { streaming.createStreamToken('dave', 'vs_rtsp', cb); });
  assert.strictEqual(r[0], null, 'other users not affected');
  ok('token rate limit');

  // --- revocation --------------------------------------------------------------
  var now = new Date().toISOString();
  var old = new Date(Date.now() - 60000).toISOString();
  gwSessions = [
    { id: 'sess-1', created: now, path: 'streaming-gw/vs_rtsp' },
    { id: 'sess-3', created: now, path: 'streaming-gw/vs_rtsp' },
    { id: 'm-0', created: now, path: 'streaming-gw/vs_rtsp2' },
    { id: 'e-0-0', created: now, path: 'streaming-gw/vs_s0' },
    { id: 'unknown-new', created: now, path: 'streaming-gw/vs_rtsp' },
    { id: 'unknown-old', created: old, path: 'streaming-gw/vs_rtsp' }
  ];
  gwKicked = [];
  var unauthorizedBefore = gwUnauthorized;
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert.deepStrictEqual(gwKicked, ['unknown-old'], 'only the old unknown session is kicked');
  assert.strictEqual(gwUnauthorized, unauthorizedBefore, 'API requests authenticated');
  // alice loses vs_rtsp: her sessions on it are kicked, her tokens dropped
  // sess-4 is not listed: forgotten once older than the record grace
  Date.now = function() { return realNow2() + 12000; };
  var t6 = await newToken('alice', 'vs_rtsp');
  Date.now = realNow2;
  perms.alice = ['vs_img', 'vs_old', 'vs_rtsp2'];
  authListeners[0]();
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert.deepStrictEqual(gwKicked.slice(1).sort(), ['sess-1', 'sess-3']);
  perms.alice = ['vs_rtsp', 'vs_img', 'vs_old', 'vs_rtsp2'];
  assert.strictEqual(hook(withField('token', t6)).reason, 'invalid or expired token', 'token dropped on revocation');
  // source removed by a reload
  var cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  delete cfg.vs_rtsp2;
  fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  streaming.reload();
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert(gwKicked.indexOf('m-0') >= 0, 'session of the removed source kicked');
  assert(logs.some(function(l) { return l.indexOf('source removed') >= 0; }));
  // gateway down: logged once, no exception
  var before = logs.filter(function(l) { return l.indexOf('listing video gateway sessions') >= 0; }).length;
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: '1', api_password: API_PASSWORD } }));
  streaming.configGateway(services);
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert.strictEqual(logs.filter(function(l) { return l.indexOf('listing video gateway sessions') >= 0; }).length, before + 1);
  // wrong API password: the gateway answers 401, logged like an unreachable API
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: String(gwPort), api_password: 'wrong' } }));
  streaming.configGateway(services);
  unauthorizedBefore = gwUnauthorized;
  await p(function(cb) { streaming.checkGatewaySessions(cb); });
  assert.strictEqual(gwUnauthorized, unauthorizedBefore + 1);
  fs.writeFileSync(services, JSON.stringify({ mediamtx: { api_port: String(gwPort), api_password: API_PASSWORD } }));
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

  // DTMF only on an answered call: the tones played on a ringing channel get lost
  var states = [
    // [conversations of the extension, DTMF sent]
    [{}, true], // no call: the DTMF sequence calls the extension
    [fakeConv('302', 'ring', false), false], // the intercom calls, the user phone is ringing
    [fakeConv('302', 'down', true), false], // the intercom is called, not ringing yet
    [fakeConv('302', 'ringing', true), false], // the intercom is called and ringing
    [fakeConv('302', 'up', false), true], // answered call made by the intercom
    [fakeConv('302', 'up', true), true] // answered call to the intercom
  ];
  for (i = 0; i < states.length; i++) {
    extenConvs = { '302': states[i][0], '301': states[i][0] };
    dtmfCalls = [];
    r = await open('vs_img', '1');
    if (states[i][1]) {
      assert.strictEqual(r[0], null, 'state ' + i + ': gate opened');
      assert.deepStrictEqual(dtmfCalls, [{ exten: '302', seq: '5' }]);
    } else {
      assert.strictEqual(r[0].status, 409, 'state ' + i + ': not answered');
      assert.strictEqual(r[0].code, 'call_not_answered');
      assert(/not answered/.test(r[0].message));
      assert.deepStrictEqual(dtmfCalls, [], 'state ' + i + ': no DTMF');
    }
  }
  // the legacy open code (source without gates) and the old open() signature
  extenConvs = { '301': fakeConv('301', 'ring', false), '302': fakeConv('302', 'ringing', true) };
  dtmfCalls = [];
  r = await open('vs_old');
  assert.strictEqual(r[0].code, 'call_not_answered', 'legacy open code while ringing');
  r = await p(function(cb) { streaming.open('vs_img', '"alice" <201>', '201', cb); });
  assert.strictEqual(r[0].status, 409, 'old open() while ringing');
  assert.deepStrictEqual(dtmfCalls, []);
  // only the channels of the extension count: here 302 is the counterpart of 301
  extenConvs = { '301': fakeConv('302', 'ringing', false) };
  r = await open('vs_old');
  assert.strictEqual(r[0], null);
  assert.deepStrictEqual(dtmfCalls, [{ exten: '301', seq: '0*' }]);
  // a second answered call of the extension allows the DTMF
  extenConvs = { '302': Object.assign(fakeConv('302', 'ringing', true), fakeConv('302', 'up', false)) };
  r = await open('vs_img');
  assert.strictEqual(r[0], null, 'one answered call');
  // URL gates do not depend on the call
  extenConvs = { '302': fakeConv('302', 'ring', false) };
  r = await open('vs_rtsp', '4');
  assert.strictEqual(r[0], null, 'URL gate while ringing');
  extenConvs = {};
  ok('DTMF gates only on answered calls (or without calls), URL gates always');

  // --- snapshots --------------------------------------------------------------
  r = await p(function(cb) { streaming.getVideoSample('vs_img', cb); });
  assert.strictEqual(r[0], null);
  assert.strictEqual(r[1], 'data:image/jpeg;base64,' + Buffer.from('JPEGDATA').toString('base64'));
  r = await p(function(cb) { streaming.getVideoSample('vs_rtsp', cb); });
  assert.strictEqual(r[0].code, 'not_image_source');
  var Streaming = require('../streaming_class').Streaming;
  var dig = new Streaming({ id: 'd', url: 'http://' + DEV_HOST + ':' + devPort + '/digest.jpg', type: 'image', image_auth: { username: 'cam', password: 'Img-Secret-9' } });
  deviceCalls = [];
  r = await p(function(cb) { dig.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0], null);
  assert.strictEqual(r[1], 'data:image/jpeg;base64,' + Buffer.from('DIGESTJPEG').toString('base64'));
  assert.deepStrictEqual(deviceCalls.map(function(c) { return c.auth; }), ['', 'Digest']);
  var noch = new Streaming({ id: 'n', url: 'http://' + DEV_HOST + ':' + devPort + '/nochallenge.jpg', type: 'image', image_auth: { username: 'cam', password: 'Img-Secret-9' } });
  r = await p(function(cb) { noch.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0], null, '401 without challenge falls back to preemptive Basic');
  var legacy = new Streaming({ id: 'l', url: 'http://' + DEV_HOST + ':' + devPort + '/basic.jpg', user: 'cam', secret: 'Img-Secret-9' });
  r = await p(function(cb) { legacy.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0], null, 'legacy user/secret used for the snapshot');
  var noauth = new Streaming({ id: 'x', url: 'http://' + DEV_HOST + ':' + devPort + '/basic.jpg', type: 'image', image_auth: null });
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
  await new Promise(function(resolve) { tlsSrv.listen(0, '0.0.0.0', resolve); });
  var tlsBase = 'https://' + DEV_HOST + ':' + tlsSrv.address().port;
  var pem = fs.readFileSync(certFile, 'utf8');
  // SHA-256 of the DER certificate, as FreePBX pins it
  var goodFp = crypto.createHash('sha256').update(Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64')).digest('hex');
  var badFp = crypto.createHash('sha256').update('another certificate').digest('hex');
  function tlsSource(descr, skip, fingerprint, gateFingerprint) {
    var s = {
      descr: descr, url: tlsBase + '/basic.jpg', user: '', secret: '', 'frame-rate': '1000', exten: null, open: '',
      type: 'image', gateway_path: null, image_auth: { username: 'cam', password: 'Img-Secret-9' },
      gates: [{ id: '1', name: 'Gate', type: 'url', url: tlsBase + '/basic', method: 'GET', username: 'gate', password: 'Gate-Spike-77' }]
    };
    if (skip !== undefined) {
      s.tls_skip_verify = skip;
    }
    if (fingerprint !== undefined) {
      s.tls_fingerprint = fingerprint;
    }
    if (gateFingerprint !== undefined) {
      s.gates[0].tls_fingerprint = gateFingerprint;
    }
    return s;
  }
  var tlsCfg = path.join(tmp, 'streaming-tls.json');
  fs.writeFileSync(tlsCfg, JSON.stringify({
    vs_tls_absent: tlsSource('No key'),
    vs_tls_off: tlsSource('Off', false),
    vs_tls_string: tlsSource('String', 'true'),
    vs_tls_on: tlsSource('On', true),
    vs_tls_pinned: tlsSource('Pinned', true, goodFp, goodFp.toUpperCase().match(/../g).join(':')),
    vs_tls_changed: tlsSource('Changed', true, badFp, badFp),
    // a fingerprint without the skip flag is ignored: the certificate is verified
    vs_tls_verify_fp: tlsSource('Verify', false, goodFp, goodFp)
  }));
  logs = [];
  streaming.config(tlsCfg);
  assert(logs.some(function(l) { return l.indexOf('"vs_tls_on" skips the TLS verification without a pinned certificate (snapshot URL, gate "1")') >= 0; }),
    'unpinned source logged');
  assert(!logs.some(function(l) { return l.indexOf('"vs_tls_pinned" skips') >= 0; }));
  deviceCalls = [];
  var sources = ['vs_tls_absent', 'vs_tls_off', 'vs_tls_string', 'vs_tls_verify_fp'];
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
  assert.strictEqual(r[0], null, 'snapshot with tls_skip_verify, not pinned (older configuration)');
  assert.strictEqual(r[1], 'data:image/jpeg;base64,' + Buffer.from('JPEGDATA').toString('base64'));
  r = await open('vs_tls_on', '1');
  assert.strictEqual(r[0], null, 'gate with tls_skip_verify');
  assert.deepStrictEqual(deviceCalls.map(function(c) { return c.url + ' ' + c.auth; }),
    ['/basic.jpg ', '/basic.jpg Basic', '/basic ', '/basic Basic']);
  // pinned certificate: accepted when it matches, refused before sending anything when it changed
  deviceCalls = [];
  r = await p(function(cb) { streaming.getVideoSample('vs_tls_pinned', cb); });
  assert.strictEqual(r[0], null, 'pinned snapshot');
  r = await open('vs_tls_pinned', '1');
  assert.strictEqual(r[0], null, 'pinned gate (fingerprint with colons)');
  assert.strictEqual(deviceCalls.length, 4);
  deviceCalls = [];
  r = await p(function(cb) { streaming.getVideoSample('vs_tls_changed', cb); });
  assert.strictEqual(r[0] && r[0].code, 'TLS_FINGERPRINT_MISMATCH', 'changed certificate refused');
  r = await open('vs_tls_changed', '1');
  assert.strictEqual(r[0].status, 502);
  assert.strictEqual(r[0].code, 'gate_certificate_changed');
  assert.strictEqual(deviceCalls.length, 0, 'no request (nor credentials) sent to a device with another certificate');
  assert(logs.some(function(l) { return l.indexOf('TLS certificate of the device changed') >= 0; }), 'mismatch logged');
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
  ok('TLS certificate verified by default, skipped only for the sources with tls_skip_verify, pinned when saved');

  // --- device addresses -------------------------------------------------------
  assert.strictEqual(deviceHttp.isBlockedAddress('127.0.0.1'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('127.255.0.9'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('0.0.0.0'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('169.254.169.254'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('::1'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('::'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('0:0:0:0:0:0:0:1'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('fe80::1'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('febf::1'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('fe80::1%eth0'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('::ffff:127.0.0.1'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('::ffff:7f00:1'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('::ffff:a9fe:a9fe'), true);
  assert.strictEqual(deviceHttp.isBlockedAddress('192.168.1.10'), false, 'LAN allowed');
  assert.strictEqual(deviceHttp.isBlockedAddress('10.0.0.1'), false);
  assert.strictEqual(deviceHttp.isBlockedAddress('172.16.0.1'), false);
  assert.strictEqual(deviceHttp.isBlockedAddress('203.0.113.7'), false);
  assert.strictEqual(deviceHttp.isBlockedAddress('fd00::1'), false);
  assert.strictEqual(deviceHttp.isBlockedAddress('fec0::1'), false);
  assert.strictEqual(deviceHttp.isBlockedAddress('::ffff:192.168.1.1'), false);
  var lp = dev[1];
  var blockedUrls = ['http://127.0.0.1:' + lp + '/open', 'http://localhost:' + lp + '/open', 'http://[::1]:' + lp + '/open',
    'http://0x7f000001:' + lp + '/open', 'http://2130706433:' + lp + '/open', 'http://0177.0.0.1:' + lp + '/open',
    'http://127.1:' + lp + '/open', 'http://[::ffff:127.0.0.1]:' + lp + '/open', 'http://169.254.169.254/latest/meta-data/',
    'http://0.0.0.0:' + lp + '/open', 'https://127.0.0.1:' + lp + '/open'];
  deviceCalls = [];
  for (i = 0; i < blockedUrls.length; i++) {
    r = await p(function(cb) { deviceHttp.deviceRequest({ uri: blockedUrls[i], timeout: 2000 }, null, {}, cb); });
    assert.strictEqual(r[0] && r[0].code, 'DEVICE_ADDRESS_NOT_ALLOWED', blockedUrls[i] + ': ' + (r[0] && r[0].code));
  }
  assert.strictEqual(deviceCalls.length, 0, 'no loopback request');
  var blockedCfg = path.join(tmp, 'streaming-blocked.json');
  fs.writeFileSync(blockedCfg, JSON.stringify({
    vs_loop: {
      descr: 'Loop', url: 'http://127.0.0.1:' + lp + '/basic.jpg', type: 'image', exten: null, open: '',
      image_auth: { username: 'cam', password: 'Img-Secret-9' },
      gates: [{ id: '1', name: 'Meta', type: 'url', url: 'http://169.254.169.254/latest/meta-data/', method: 'GET', username: '', password: '' }]
    }
  }));
  streaming.config(blockedCfg);
  r = await p(function(cb) { streaming.getVideoSample('vs_loop', cb); });
  assert.strictEqual(r[0] && r[0].code, 'DEVICE_ADDRESS_NOT_ALLOWED', 'loopback snapshot refused');
  r = await open('vs_loop', '1');
  assert.strictEqual(r[0].code, 'gate_address_not_allowed', 'link-local gate refused');
  assert.strictEqual(deviceCalls.length, 0);
  r = await p(function(cb) { deviceHttp.deviceRequest({ uri: 'ftp://' + DEV_HOST + '/x', timeout: 2000 }, null, {}, cb); });
  assert.strictEqual(r[0].code, 'EINVALIDURL');
  ok('loopback, link-local and unspecified device addresses refused, LAN allowed');

  // --- response limits and redirects ------------------------------------------
  var big = new Streaming({ id: 'b', url: 'http://' + DEV_HOST + ':' + lp + '/big.jpg', type: 'image' });
  r = await p(function(cb) { big.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0] && r[0].code, 'RESPONSE_TOO_LARGE', 'snapshot bigger than 5 MB refused');
  var chunked = new Streaming({ id: 'c', url: 'http://' + DEV_HOST + ':' + lp + '/bigchunked.jpg', type: 'image' });
  r = await p(function(cb) { chunked.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0] && r[0].code, 'RESPONSE_TOO_LARGE', 'chunked snapshot bigger than 5 MB refused');
  var redirected = new Streaming({ id: 'r', url: 'http://' + DEV_HOST + ':' + lp + '/redirect.jpg', type: 'image', image_auth: { username: 'cam', password: 'Img-Secret-9' } });
  deviceCalls = [];
  r = await p(function(cb) { redirected.getSample(function(e, id, img) { cb(e, img); }); });
  assert.strictEqual(r[0], 'HTTP status 302', 'snapshot redirect not followed');
  assert.deepStrictEqual(deviceCalls.map(function(c) { return c.url; }), ['/redirect.jpg'], 'credentials not sent to the redirect target');
  var gateCfg = path.join(tmp, 'streaming-big.json');
  fs.writeFileSync(gateCfg, JSON.stringify({
    vs_big: { descr: 'Big', url: '', type: 'rtsp', gateway_path: 'streaming-gw/vs_big', gates: [
      { id: '1', name: 'Big', type: 'url', url: 'http://' + DEV_HOST + ':' + lp + '/big', method: 'GET', username: '', password: '' }] }
  }));
  streaming.config(gateCfg);
  r = await open('vs_big', '1');
  assert.strictEqual(r[0].code, 'gate_failed', 'gate response bigger than 64 KB');
  assert(/too large/.test(r[0].message));
  ok('response size limits and no redirects');

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
