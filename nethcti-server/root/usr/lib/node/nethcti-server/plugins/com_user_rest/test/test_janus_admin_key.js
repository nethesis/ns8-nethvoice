// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later

var assert = require('assert');
var user = require('../plugins_rest/user');

var permitted = true;
var expectedUser = 'alice';
user.setLogger({ log: { info: function() {}, warn: function() {}, error: function() {} } });
user.setCompAuthorization({
  authorizeScreenSharing: function(username) {
    return permitted && username === expectedUser;
  }
});

function request(username) {
  var response = { headers: {} };
  user.janus_admin_key({ headers: { authorization_user: username } }, {
    header: function(name, value) {
      response.headers[name] = value;
    },
    send: function(status, body) {
      response.status = status;
      response.body = body;
    }
  });
  assert.strictEqual(response.headers['Cache-Control'], 'no-store');
  return [response.status, response.body];
}

assert(user.api.get.includes('janus_admin_key'));
var fixture = 'VideoRoomTestKey42';
var original = process.env.JANUS_ADMIN_SECRET;
try {
  process.env.JANUS_ADMIN_SECRET = fixture;
  assert.deepStrictEqual(request(undefined), [403, undefined]);
  assert.deepStrictEqual(request('bob'), [403, undefined]);
  assert.deepStrictEqual(request('alice'), [200, { admin_key: fixture }]);

  permitted = false;
  assert.deepStrictEqual(request('alice'), [403, undefined]);
  permitted = true;

  delete process.env.JANUS_ADMIN_SECRET;
  assert.deepStrictEqual(request('alice'), [503, undefined]);
  for (var invalid of ['', 'key with spaces', 'key\n']) {
    process.env.JANUS_ADMIN_SECRET = invalid;
    assert.deepStrictEqual(request('alice'), [503, undefined]);
  }
} finally {
  if (original === undefined) delete process.env.JANUS_ADMIN_SECRET;
  else process.env.JANUS_ADMIN_SECRET = original;
}
