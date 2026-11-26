/**
 * Tests of the Tancredi requests of the CTI users: allowed paths and
 * queries, phone owner check, PATCH body checks, URL, headers and body
 * forwarded to Tancredi, data of the answers sent to the CTI.
 *
 * Run with: node plugins/http_proxy/test/test_tancredi_proxy.js
 *
 * @module http_proxy
 * @submodule test
 */
var assert = require('assert');
var http = require('http');

var tancrediProxy = require('../tancredi_proxy');

var OWN_MAC = '0C-38-3E-00-00-01';
var OTHER_MAC = '0C-38-3E-00-00-02';
var SECRET_KEY = 'Admin-Secret-Key-1';

var quietLog = { log: { info: function () {}, warn: function () {}, error: function () {} } };

function testParseRequest() {
  var p = tancrediProxy.parseRequest;

  assert.deepStrictEqual(p('GET', '/tancredi/api/v1/phones/' + OWN_MAC),
    { type: 'phone', mac: OWN_MAC, url: '/tancredi/api/v1/phones/' + OWN_MAC });
  assert.deepStrictEqual(p('GET', '/tancredi/api/v1/phones/' + OWN_MAC + '?inherit=1'),
    { type: 'phone', mac: OWN_MAC, url: '/tancredi/api/v1/phones/' + OWN_MAC + '?inherit=1' });
  assert.deepStrictEqual(p('PATCH', '/tancredi/api/v1/phones/' + OWN_MAC),
    { type: 'phone', mac: OWN_MAC, url: '/tancredi/api/v1/phones/' + OWN_MAC });
  assert.deepStrictEqual(p('GET', '/tancredi/api/v1/models/fanvil-X5U'),
    { type: 'model', model: 'fanvil-X5U', url: '/tancredi/api/v1/models/fanvil-X5U' });
  assert.deepStrictEqual(p('GET', '/tancredi/api/v1/models/yealink-T4.x_1'),
    { type: 'model', model: 'yealink-T4.x_1', url: '/tancredi/api/v1/models/yealink-T4.x_1' });
  // dot segments are resolved before the check
  assert.deepStrictEqual(p('GET', '/tancredi/api/v1/models/../phones/' + OWN_MAC),
    { type: 'phone', mac: OWN_MAC, url: '/tancredi/api/v1/phones/' + OWN_MAC });

  var refused = [
    // the MAC in the query is not the checked one
    ['GET', '/tancredi/api/v1/phones/' + OTHER_MAC + '?x=/' + OWN_MAC],
    ['GET', '/tancredi/api/v1/defaults?x=/' + OWN_MAC],
    ['GET', '/tancredi/api/v1/phones?x=/' + OWN_MAC],
    ['PATCH', '/tancredi/api/v1/phones/' + OTHER_MAC + '?x=/' + OWN_MAC],
    ['PATCH', '/tancredi/api/v1/defaults?x=/' + OWN_MAC],
    ['PATCH', '/tancredi/api/v1/models/fanvil-X5U?x=/' + OWN_MAC],
    // other queries
    ['GET', '/tancredi/api/v1/phones/' + OWN_MAC + '?inherit=1&x=1'],
    ['GET', '/tancredi/api/v1/phones/' + OWN_MAC + '?inherit=0'],
    ['PATCH', '/tancredi/api/v1/phones/' + OWN_MAC + '?inherit=1'],
    ['GET', '/tancredi/api/v1/models/fanvil-X5U?inherit=1'],
    // other paths and methods
    ['GET', '/tancredi/api/v1/phones'],
    ['GET', '/tancredi/api/v1/defaults'],
    ['PATCH', '/tancredi/api/v1/defaults'],
    ['GET', '/tancredi/api/v1/phones/' + OWN_MAC + '/'],
    ['POST', '/tancredi/api/v1/phones/' + OWN_MAC + '/tok1'],
    ['GET', '/tancredi/api/v1/phones/' + OWN_MAC + '/x'],
    ['GET', '/tancredi/api/v1/models'],
    ['GET', '/tancredi/api/v1/models/fanvil-X5U/version/original'],
    ['GET', '/tancredi/api/v1/models/..'],
    ['GET', '/tancredi/api/v1/models/.hidden'],
    ['GET', '/tancredi/api/v1/models/%2e%2e'],
    ['GET', '/tancredi/api/v1/models/a%2Fb'],
    ['PATCH', '/tancredi/api/v1/models/fanvil-X5U'],
    ['DELETE', '/tancredi/api/v1/phones/' + OWN_MAC],
    ['POST', '/tancredi/api/v1/phones/' + OWN_MAC],
    ['PUT', '/tancredi/api/v1/phones/' + OWN_MAC],
    // MAC formats other than the CTI one
    ['GET', '/tancredi/api/v1/phones/0c-38-3e-00-00-01'],
    ['GET', '/tancredi/api/v1/phones/0C:38:3E:00:00:01'],
    ['GET', '/tancredi/api/v1/phones/0C383E000001'],
    ['GET', '/tancredi/api/v1/phones/0C-38-3E-00-00-01-02'],
    ['GET', '/tancredi/api/v1/phones/0C%2D38-3E-00-00-01'],
    // other hosts and malformed URLs
    ['GET', '//example.com/tancredi/api/v1/phones/' + OWN_MAC],
    ['GET', 'http://example.com/tancredi/api/v1/phones/' + OWN_MAC],
    ['GET', '/tancredix/api/v1/phones/' + OWN_MAC],
    ['GET', ''],
    ['GET', undefined]
  ];
  refused.forEach(function (r) {
    assert.strictEqual(p(r[0], r[1]), null, r[0] + ' ' + r[1] + ' must be refused');
  });
}

function testCheckPatchBody() {
  var c = tancrediProxy.checkPatchBody;
  var ok = c(JSON.stringify({ variables: {
    linekey_type_1: 'blf', linekey_value_1: '201', linekey_label_1: 'Reception',
    expkey_type_41: '', expkey_value_41: null, expkey_label_41: 'Àà ü'
  } }));
  assert.deepStrictEqual(ok, { body: { variables: {
    linekey_type_1: 'blf', linekey_value_1: '201', linekey_label_1: 'Reception',
    expkey_type_41: '', expkey_value_41: null, expkey_label_41: 'Àà ü'
  } } });

  function status(body) {
    return c(typeof body === 'string' ? body : JSON.stringify(body)).status;
  }
  // malformed bodies
  assert.strictEqual(status('not json'), 400);
  assert.strictEqual(status('[]'), 400);
  assert.strictEqual(status('null'), 400);
  assert.strictEqual(status({}), 400);
  assert.strictEqual(status({ variables: {} }), 400);
  assert.strictEqual(status({ variables: [] }), 400);
  assert.strictEqual(status({ variables: { linekey_type_1: 'blf' }, model: 'fanvil-X5U' }), 400);
  assert.strictEqual(status({ model: 'fanvil-X5U' }), 400);
  // variables the CTI does not change
  ['adminpw', 'userpw', 'door_dtmf_code', 'door_rtsp_password', 'door_relay_duration_1',
    'account_password_1', 'softkey_type_1', 'linekey_type_0', 'linekey_type_', 'linekey_type_1x',
    'linekey_type_12345', 'LINEKEY_TYPE_1', 'linekey_foo_1', '__proto__', 'tok1', 'provisioning_url1'
  ].forEach(function (name) {
    // JSON text: "__proto__" must be an own key of the parsed object
    assert.strictEqual(status('{"variables": {' + JSON.stringify(name) + ': "x"}}'), 403, name + ' must be refused');
  });
  // values
  [
    'a\nb', 'a\rb', 'a\u0000b', 'a\tb', 'a\u007fb', new Array(257).join('x'), 1, true, {}, []
  ].forEach(function (value) {
    assert.strictEqual(status({ variables: { linekey_label_1: value } }), 400, JSON.stringify(value) + ' must be refused');
  });
  assert.ok(c(JSON.stringify({ variables: { linekey_label_1: new Array(256).join('x') } })).body);
}

// Tancredi data with the variables the CTI must not receive
var PHONE = {
  mac: OWN_MAC,
  short_mac: '0c383e000001',
  model: 'fanvil-X5U',
  display_name: 'Alice phone',
  tok1: 'first-token',
  tok2: 'second-token',
  provisioning_url1: 'https://pbx/provisioning/first-token/0c383e000001.cfg',
  provisioning_url2: 'https://pbx/provisioning/second-token/0c383e000001.cfg',
  model_url: '/tancredi/api/v1/models/fanvil-X5U',
  variables: {
    adminpw: 'Admin-Pw', userpw: 'User-Pw', ldap_password: 'Ldap-Pw', ldap_user: 'cn=ldap',
    account_password_1: 'Sip-Pw', account_username_1: '201',
    door_rtsp_password: 'Rtsp-Pw', door_dtmf_code: '*7', door_open_url_user: 'admin',
    provisioning_url_path: 'provisioning/', hostname: 'pbx',
    linekey_type_1: 'blf', linekey_value_1: '202', linekey_label_1: 'Bob',
    expkey_type_1: 'speed_dial', expkey_value_1: '203', expkey_label_1: 'Carol',
    softkey_type_1: 'dnd', cap_linekey_count: '6', cap_door_phone: ''
  }
};
var MODEL = {
  name: 'fanvil-X5U',
  display_name: 'Fanvil X5U',
  model_url: '/tancredi/api/v1/models/fanvil-X5U',
  variables: {
    cap_linekey_count: '6', cap_expkey_count: '20', cap_expmodule_count: '3',
    adminpw: 'Model-Admin-Pw', ldap_password: 'Model-Ldap-Pw', tmpl_phone: 'fanvil.tmpl'
  }
};
var SECRETS = ['Admin-Pw', 'User-Pw', 'Ldap-Pw', 'Sip-Pw', 'Rtsp-Pw', '*7', 'first-token', 'second-token', 'cn=ldap'];

function testFilterResponse() {
  var f = tancrediProxy.filterResponse;
  assert.deepStrictEqual(f('phone', PHONE), {
    mac: OWN_MAC,
    short_mac: '0c383e000001',
    model: 'fanvil-X5U',
    display_name: 'Alice phone',
    model_url: '/tancredi/api/v1/models/fanvil-X5U',
    variables: {
      linekey_type_1: 'blf', linekey_value_1: '202', linekey_label_1: 'Bob',
      expkey_type_1: 'speed_dial', expkey_value_1: '203', expkey_label_1: 'Carol',
      cap_linekey_count: '6', cap_door_phone: ''
    }
  });
  assert.deepStrictEqual(f('model', MODEL), {
    name: 'fanvil-X5U',
    display_name: 'Fanvil X5U',
    model_url: '/tancredi/api/v1/models/fanvil-X5U',
    variables: { cap_linekey_count: '6', cap_expkey_count: '20', cap_expmodule_count: '3' }
  });
  // an empty scope keeps an empty variables object
  assert.deepStrictEqual(f('phone', { mac: OWN_MAC, variables: {} }).variables, {});
  assert.deepStrictEqual(f('phone', { mac: OWN_MAC, variables: [] }).variables, {});
  assert.strictEqual(f('phone', null), null);
  assert.strictEqual(f('phone', []), null);
  assert.strictEqual(f('phone', 'text'), null);
  assert.strictEqual(f('other', PHONE), null);
}

// fake Tancredi: records the requests and answers with fixed data
function startFakeTancredi(cb) {
  var requests = [];
  var server = http.createServer(function (req, res) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
      var path = req.url.split('?')[0];
      if (path === '/tancredi/api/v1/phones/' + OWN_MAC) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(PHONE));
      } else if (path === '/tancredi/api/v1/models/fanvil-X5U') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(MODEL));
      } else if (path === '/tancredi/api/v1/models/broken') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>' + JSON.stringify(PHONE) + '</html>');
      } else if (path === '/tancredi/api/v1/models/failing') {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('error in /usr/share/tancredi/src/Entity/Scope.php');
      } else {
        res.writeHead(404, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({ type: 'https://nethesis.github.io/tancredi/problems/#not-found', title: 'Resource not found' }));
      }
    });
  });
  server.listen(0, '127.0.0.1', function () {
    cb(server, requests);
  });
}

function assertNoSecrets(body) {
  SECRETS.forEach(function (secret) {
    assert.strictEqual(body.indexOf(secret), -1, 'the answer must not contain ' + secret);
  });
}

function startProxy(target, cb) {
  var handle = tancrediProxy.create({
    target: target,
    getSecretKey: function () { return SECRET_KEY; },
    logger: quietLog,
    idlog: '[test]'
  });
  var server = http.createServer(function (req, res) {
    handle(req, res, {
      name: 'alice',
      isPhoneOwner: function (mac) { return mac === OWN_MAC; }
    });
  });
  server.listen(0, '127.0.0.1', function () {
    cb(server);
  });
}

function request(port, method, path, body, chunked, cb) {
  var headers = {
    Authorization: 'alice:cti-token',
    User: 'someone',
    SecretKey: 'wrong',
    Cookie: 'a=b',
    'Content-Type': 'application/json',
    'X-Forwarded-For': '192.0.2.10'
  };
  if (body !== undefined && !chunked) {
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  var req = http.request({ host: '127.0.0.1', port: port, method: method, path: path, headers: headers }, function (res) {
    var chunks = [];
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () { cb(res.statusCode, Buffer.concat(chunks).toString()); });
  });
  if (body !== undefined && chunked) {
    // two writes without Content-Length: chunked transfer encoding
    req.write(body.substring(0, 10));
    req.end(body.substring(10));
  } else {
    req.end(body);
  }
}

function series(steps, done) {
  var i = 0;
  (function next() {
    if (i >= steps.length) {
      return done();
    }
    steps[i++](next);
  })();
}

function testForwarding(done) {
  startFakeTancredi(function (tancredi, requests) {
    startProxy('http://127.0.0.1:' + tancredi.address().port, function (proxy) {
      var port = proxy.address().port;
      var patchBody = JSON.stringify({ variables: { linekey_label_1: 'Reception', linekey_value_1: '201' } });
      series([
        function (next) {
          request(port, 'GET', '/tancredi/api/v1/phones/' + OWN_MAC + '?inherit=1', undefined, false, function (status, body) {
            assert.strictEqual(status, 200);
            assert.deepStrictEqual(JSON.parse(body), tancrediProxy.filterResponse('phone', PHONE));
            assertNoSecrets(body);
            var r = requests.pop();
            assert.strictEqual(r.headers['accept-encoding'], 'identity');
            assert.strictEqual(r.method, 'GET');
            assert.strictEqual(r.url, '/tancredi/api/v1/phones/' + OWN_MAC + '?inherit=1');
            assert.strictEqual(r.headers.user, 'admin');
            assert.strictEqual(r.headers.secretkey, SECRET_KEY);
            assert.strictEqual(r.headers.authorization, undefined);
            assert.strictEqual(r.headers.cookie, undefined);
            assert.strictEqual(r.headers['x-forwarded-for'], '192.0.2.10');
            next();
          });
        },
        function (next) {
          request(port, 'GET', '/tancredi/api/v1/models/fanvil-X5U', undefined, false, function (status, body) {
            assert.strictEqual(status, 200);
            assert.deepStrictEqual(JSON.parse(body), tancrediProxy.filterResponse('model', MODEL));
            assertNoSecrets(body);
            assert.strictEqual(body.indexOf('Model-'), -1);
            assert.strictEqual(requests.pop().url, '/tancredi/api/v1/models/fanvil-X5U');
            next();
          });
        },
        function (next) {
          // dot segments: the resolved path is checked and forwarded
          request(port, 'GET', '/tancredi/api/v1/models/x/../../phones/' + OWN_MAC, undefined, false, function (status) {
            assert.strictEqual(status, 200);
            assert.strictEqual(requests.pop().url, '/tancredi/api/v1/phones/' + OWN_MAC);
            next();
          });
        },
        function (next) {
          request(port, 'PATCH', '/tancredi/api/v1/phones/' + OWN_MAC, patchBody, true, function (status, body) {
            assert.strictEqual(status, 200);
            assertNoSecrets(body);
            var r = requests.pop();
            assert.strictEqual(r.method, 'PATCH');
            assert.strictEqual(r.url, '/tancredi/api/v1/phones/' + OWN_MAC);
            assert.strictEqual(r.body, patchBody);
            assert.strictEqual(r.headers['content-length'], String(Buffer.byteLength(patchBody)));
            assert.strictEqual(r.headers['transfer-encoding'], undefined);
            assert.strictEqual(r.headers['content-type'], 'application/json');
            assert.strictEqual(r.headers.secretkey, SECRET_KEY);
            next();
          });
        },
        function (next) {
          // the same body with Content-Length
          request(port, 'PATCH', '/tancredi/api/v1/phones/' + OWN_MAC, patchBody, false, function (status) {
            assert.strictEqual(status, 200);
            assert.strictEqual(requests.pop().body, patchBody);
            next();
          });
        },
        function (next) {
          // Tancredi errors: 4xx with their problem description, 5xx without body
          request(port, 'GET', '/tancredi/api/v1/models/missing', undefined, false, function (status, body) {
            assert.strictEqual(status, 404);
            assert.strictEqual(JSON.parse(body).title, 'Resource not found');
            request(port, 'GET', '/tancredi/api/v1/models/failing', undefined, false, function (status, body) {
              assert.strictEqual(status, 500);
              assert.strictEqual(body, '');
              request(port, 'GET', '/tancredi/api/v1/models/broken', undefined, false, function (status, body) {
                assert.strictEqual(status, 502);
                assert.strictEqual(body, '');
                next();
              });
            });
          });
        },
        function (next) {
          var refused = [
            ['GET', '/tancredi/api/v1/phones/' + OTHER_MAC, undefined, 403],
            ['GET', '/tancredi/api/v1/phones/' + OTHER_MAC + '?x=/' + OWN_MAC, undefined, 403],
            ['GET', '/tancredi/api/v1/defaults?x=/' + OWN_MAC, undefined, 403],
            ['GET', '/tancredi/api/v1/phones?x=/' + OWN_MAC, undefined, 403],
            ['PATCH', '/tancredi/api/v1/phones/' + OTHER_MAC, patchBody, 403],
            ['PATCH', '/tancredi/api/v1/phones/' + OTHER_MAC + '?x=/' + OWN_MAC, patchBody, 403],
            ['PATCH', '/tancredi/api/v1/defaults?x=/' + OWN_MAC, JSON.stringify({ adminpw: 'x' }), 403],
            ['PATCH', '/tancredi/api/v1/phones/' + OWN_MAC, JSON.stringify({ variables: { adminpw: 'x' } }), 403],
            ['PATCH', '/tancredi/api/v1/phones/' + OWN_MAC, JSON.stringify({ variables: { door_dtmf_code: '1' } }), 403],
            ['PATCH', '/tancredi/api/v1/phones/' + OWN_MAC, JSON.stringify({ model: 'fanvil-X5U' }), 400],
            ['PATCH', '/tancredi/api/v1/phones/' + OWN_MAC, JSON.stringify({ variables: { linekey_label_1: 'a\nb' } }), 400],
            ['PATCH', '/tancredi/api/v1/phones/' + OWN_MAC, '{"variables": ', 400],
            ['PATCH', '/tancredi/api/v1/phones/' + OWN_MAC, JSON.stringify({ variables: { linekey_label_1: new Array(70000).join('x') } }), 413],
            ['DELETE', '/tancredi/api/v1/phones/' + OWN_MAC, undefined, 403]
          ];
          var count = requests.length;
          series(refused.map(function (r) {
            return function (step) {
              request(port, r[0], r[1], r[2], false, function (status) {
                assert.strictEqual(status, r[3], r[0] + ' ' + r[1] + ' ' + (r[2] || '').substring(0, 60));
                step();
              });
            };
          }), function () {
            assert.strictEqual(requests.length, count, 'refused requests must not reach Tancredi');
            next();
          });
        }
      ], function () {
        proxy.close();
        tancredi.close();
        done();
      });
    });
  });
}

function testTancrediDown(done) {
  // a closed port: the client gets 502
  var probe = http.createServer().listen(0, '127.0.0.1', function () {
    var deadPort = probe.address().port;
    probe.close(function () {
      startProxy('http://127.0.0.1:' + deadPort, function (proxy) {
        request(proxy.address().port, 'GET', '/tancredi/api/v1/models/fanvil-X5U', undefined, false, function (status) {
          assert.strictEqual(status, 502);
          proxy.close();
          done();
        });
      });
    });
  });
}

testParseRequest();
testCheckPatchBody();
testFilterResponse();
series([testForwarding, testTancrediDown], function () {
  console.log('tancredi proxy tests: OK');
});
