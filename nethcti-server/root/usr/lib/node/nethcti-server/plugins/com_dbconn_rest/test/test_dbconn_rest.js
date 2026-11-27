var assert = require('assert');
var rest = require('../plugins_rest/dbconn');

var logged = [];
function record() { logged.push(Array.prototype.slice.call(arguments).join(' ')); }
rest.setLogger({ log: { info: record, warn: record, error: record } });

var tested = [];
var failing = false;
rest.setCompDbConn({
  testConnection: function(host, port, type, user, pass, name, cb) {
    tested.push([host, port, type, user, pass, name]);
    cb(failing ? 'access denied' : null);
  }
});
rest.setCompUtil({ net: {
  sendHttp400: function(id, res) { res.send(400); },
  sendHttp403: function(id, res) { res.send(403); },
  sendHttp500: function(id, res) { res.send(500); }
} });

function fakeRes() {
  return { status: null, sent: 0, send: function(status) { this.status = status; this.sent++; } };
}

function test(headers, params) {
  var res = fakeRes();
  rest.test({ headers: headers, params: params }, res, function() {});
  return res;
}

var params = { host: '127.0.0.1', port: '3306', type: 'mysql', user: 'freepbxuser', pass: 'Qa-Guess-Pass-1', name: 'asterisk' };

[
  { authorization_user: 'alice' },
  { authorization_user: 'admin' },
  { authorization_user: 'alice', authorization_freepbx_admin: 'false' }
].forEach(function(headers) {
  var res = test(headers, params);
  assert.strictEqual(res.status, 403, 'test allowed with ' + JSON.stringify(headers));
  assert.strictEqual(res.sent, 1);
});
assert.strictEqual(tested.length, 0, 'a CTI user tested a database connection');
console.log('ok - connection test refused to CTI users');

var admin = { authorization_user: 'admin', authorization_freepbx_admin: 'true' };
assert.strictEqual(test(admin, params).status, 200);
failing = true;
assert.strictEqual(test(admin, params).status, 503);
assert.deepStrictEqual(tested, [
  ['127.0.0.1', '3306', 'mysql', 'freepbxuser', 'Qa-Guess-Pass-1', 'asterisk'],
  ['127.0.0.1', '3306', 'mysql', 'freepbxuser', 'Qa-Guess-Pass-1', 'asterisk']
]);
assert.strictEqual(test(admin, { host: '127.0.0.1' }).status, 400);
console.log('ok - connection test of the FreePBX admin');

var all = logged.join('\n');
assert.ok(all.indexOf('Qa-Guess-Pass-1') === -1, 'password logged: ' + all);
assert.ok(all.indexOf('test db connection success') !== -1 && all.indexOf('test db connection failed') !== -1, 'results not logged');
assert.ok(all.indexOf('"host":"127.0.0.1"') !== -1 && all.indexOf('"user":"freepbxuser"') !== -1, 'target not logged');
console.log('ok - logs without the password');

console.log('\n3 groups passed');
