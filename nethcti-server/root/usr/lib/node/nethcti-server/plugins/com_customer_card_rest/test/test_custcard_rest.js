var assert = require('assert');
var rest = require('../plugins_rest/custcard');

var quiet = { info: function() {}, warn: function() {}, error: function() {} };
rest.setLogger({ log: quiet });

var previews = [];
var previewError = null;
rest.setCompCustomerCard({
  getCustomerCardPreview: function(query, dbconnId, template, cb) {
    previews.push({ query: query, dbconnId: dbconnId, template: template });
    if (previewError) {
      cb(previewError);
      return;
    }
    cb(null, [{ name: 'QA' }]);
  }
});
rest.setCompUtil({ net: {
  sendHttp400: function(id, res) { res.send(400); },
  sendHttp403: function(id, res) { res.send(403); },
  sendHttp500: function(id, res) { res.send(500); }
} });

function fakeRes() {
  return {
    status: null,
    sent: 0,
    connection: { remoteAddress: '127.0.0.1' },
    send: function(status, body) { this.status = status; this.body = body; this.sent++; }
  };
}

function preview(headers, params) {
  var res = fakeRes();
  rest.preview({ headers: headers, params: params }, res, function() {});
  return res;
}

var valid = { dbconn_id: '2', template: 'identity', query: Buffer.from('DELETE FROM qa_table').toString('base64') };

[
  { authorization_user: 'alice' },
  { authorization_user: 'admin' },
  { authorization_user: 'alice', authorization_freepbx_admin: 'yes' },
  { authorization_user: 'alice', authorization_freepbx_admin: true }
].forEach(function(headers) {
  var res = preview(headers, valid);
  assert.strictEqual(res.status, 403, 'preview allowed with ' + JSON.stringify(headers));
  assert.strictEqual(res.sent, 1);
});
assert.strictEqual(previews.length, 0, 'a CTI user ran a preview query');
console.log('ok - preview refused to CTI users');

var admin = { authorization_user: 'admin', authorization_freepbx_admin: 'true' };
var res = preview(admin, valid);
assert.strictEqual(res.status, 200);
assert.deepStrictEqual(previews.pop(), { query: 'DELETE FROM qa_table', dbconnId: '2', template: 'identity' });
console.log('ok - preview of the FreePBX admin');

[{}, { dbconn_id: 2, template: 'identity', query: valid.query }, { dbconn_id: '2', template: 'identity' }].forEach(function(params) {
  var r = preview(admin, params);
  assert.strictEqual(r.status, 400, 'params ' + JSON.stringify(params));
  assert.strictEqual(r.sent, 1, 'answered twice to ' + JSON.stringify(params));
});
assert.strictEqual(previews.length, 0, 'preview run with invalid parameters');
console.log('ok - invalid preview parameters');

previewError = "Error: ER_PARSE_ERROR: You have an error in your SQL syntax near 'FORM qa_table'";
var failed = preview(admin, valid);
previewError = null;
assert.strictEqual(failed.status, 422, 'query error answered ' + failed.status);
assert.strictEqual(failed.sent, 1);
assert.deepStrictEqual(failed.body, { error: "Error: ER_PARSE_ERROR: You have an error in your SQL syntax near 'FORM qa_table'" });
console.log('ok - query error of the preview');

console.log('\n4 groups passed');
