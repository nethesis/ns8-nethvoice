var assert = require('assert');
var Module = require('module');

var queries = [];
var load = Module._load;
Module._load = function(request) {
  if (request === 'mssql') {
    return {
      Request: function(connection) {
        this.query = function(query, cb) {
          queries.push({ conn: connection, query: query });
          cb(null, []);
        };
      }
    };
  }
  if (request === 'google-libphonenumber') {
    return { PhoneNumberUtil: { getInstance: function() { return {}; } } };
  }
  return load.apply(this, arguments);
};
var plugin = require('../plugins/dbconn_customer_card');
Module._load = load;

var quiet = { info: function() {}, warn: function() {}, error: function() {} };
plugin.setLogger({ log: quiet });

function connection(id) {
  return {
    id: id,
    getQueryInterface: function() {
      return { escape: function(value) { return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; } };
    },
    query: function(query, cb) {
      queries.push({ conn: id, query: query });
      if (typeof cb === 'function') {
        cb(null, { rows: [] });
        return;
      }
      return Promise.resolve([[]]);
    }
  };
}

var template = "select * from contacts where phone like '%$NUMBER' or fax = '$NUMBER'";
plugin.setCompDbconnMain({
  dbConnCustCard: { 3: connection('mysql'), 4: connection('postgres'), 5: 'mssql' },
  getDbConfigCustCardData: function() {
    return { 3: { type: 'mysql' }, 4: { type: 'postgres' }, 5: { type: 'mssql:7_4' } };
  },
  getCustCardTemplatesData: function() {
    return {
      cc_mysql: { dbconn_id: 3, query: template },
      cc_pg: { dbconn_id: 4, query: template },
      cc_ms: { dbconn_id: 5, query: template }
    };
  },
  isMssqlType: function(type) { return type.indexOf('mssql') === 0; },
  incNumExecQueries: function() {}
});

function run(permissionId, num) {
  queries.length = 0;
  plugin.apiList.getCustomerCardByNum(permissionId, 'cc_custom', num, function() {});
  assert.strictEqual(queries.length, 1, 'no query run for ' + permissionId);
  return queries[0].query;
}

function literals(query) {
  var found = [];
  var re = /'((?:[^']|'')*)'/g;
  var m;
  while ((m = re.exec(query)) !== null) {
    found.push(m[1]);
  }
  return { values: found, outside: query.replace(re, '') };
}

var outsideTemplate = literals(template).outside;

['cc_pg', 'cc_ms'].forEach(function(id) {
  assert.strictEqual(run(id, '0123456789'), template.replace(/\$NUMBER/g, '0123456789'), id + ' plain number changed');
  [
    "1' OR '1'='1",
    "1'; DROP TABLE contacts; --",
    "$' OR 1=1 --",
    "$` OR 1=1 --",
    "$& OR 1=1",
    "x\u0000' OR 1=1 --"
  ].forEach(function(num) {
    var query = run(id, num);
    assert.strictEqual(literals(query).outside, outsideTemplate, id + ' query structure changed by ' + JSON.stringify(num) + ': ' + query);
  });
});
assert.strictEqual(run('cc_pg', "a'b\\c"), template.replace(/\$NUMBER/g, "a''b\\\\c"));
assert.strictEqual(run('cc_ms', "a'b\\c"), template.replace(/\$NUMBER/g, "a''b\\c"));
console.log('ok - postgres and mssql numbers stay inside the quoted values');

assert.strictEqual(run('cc_mysql', '$` 1 OR 1=1 --'), template.split('$NUMBER').join('$` 1 OR 1=1 --'));
assert.strictEqual(run('cc_mysql', '0123456789'), template.replace(/\$NUMBER/g, '0123456789'));
console.log('ok - mysql replacement patterns are not expanded');

console.log('\n2 groups passed');
