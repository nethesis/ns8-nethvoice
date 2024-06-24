//
// phonebook.js
// 
// This is a simple LDAP server which reads records from 
// phonebook MySQL database and return results in LDAP format.
//
// No LDAP bind is requires by clients.
//
// Usage:
//    node phonebook.js <config_file>
//
// The config file must be in JSON format

const util = require('util')
var ldap = require('ldapjs');
var mysql = require("mysql");
var fs = require('fs');
var addrbooks = [];
var config_file = "";
var authentication = false;
var config = {
  "debug" : false,
  "port" : 389,
  "db_host" : "localhost",
  "db_port" : "3306",
  "db_user" : "",
  "db_pass" : "",
  "db_name" : "",
  "basedn" : "dc=phonebook, dc=nh",
  "user": "nobody",
  "group": "nobody",
  "limit": -1
}

// load config file;
if (process.argv[2]) {
  config_file = process.argv[2];
}

if (config_file) {
  if ( !config_file.startsWith("/") ) {
      config_file = "./"+config_file;
  }
  config = require(config_file);
}
_debug("Loaded config: "+util.inspect(config));

var server;
if (config.certificate !== undefined && config.key !== undefined) {
  server = ldap.createServer({"certificate": fs.readFileSync(config.certificate, 'utf8'), "key": fs.readFileSync(config.key, 'utf8')});
} else {
  server = ldap.createServer();
}

if (config.username !== undefined && config.password !== undefined) {
  authentication = true;
}

var db = mysql.createConnection({
  host: config.db_host,
  port: config.db_port,
  user: config.db_user,
  password: config.db_pass,
  database: config.db_name
});



function _debug (msg) {
  if (config.debug) {
      console.log(msg);
  }
}

// convert to lowercase search paramiters of filter and its subfilters
function lowercaseSearchParameters(filter){
    if (typeof filter.initial !== 'undefined') {
        filter.initial = filter.initial.toLowerCase();
    }
    if (typeof filter.final !== 'undefined') {
        filter.final = filter.final.toLowerCase();
    }
    if (typeof filter.any !== 'undefined') {
        var index;
        for (index = 0; index < filter.any.length; ++index) {
            filter.any[index] = filter.any[index].toLowerCase();
        }
    }
    // recursively call lowercaseSearchParameters() for nested filters
    if (typeof filter.filters !== 'undefined') {
        var index;
        for (index = 0; index < filter.filters.length; ++index) {
            filter.filters[index] = lowercaseSearchParameters(filter.filters[index]);
        }
    }

    return filter;
}

db.query("SELECT substr(name,1,63) as name,substr(company,1,63) as company,homephone,workphone,cellphone,fax FROM phonebook", function(err, contacts) {
  if (err) {
    console.log("Error fetching records", err);
    process.exit(1);
  }

  for (var i = 0; i < contacts.length; i++) {

    if (!contacts[i].workphone && !contacts[i].cellphone && !contacts[i].homephone) {
        continue;
    }

    company = contacts[i].company;
    if (company) {
        company = company.toLowerCase();
    }

    if (contacts[i].name) {
        name = contacts[i].name.toLowerCase();
    } else {
        if (company) {
          name = company;
        } else {
          continue;
        }
    }
    // replace invalid chars in dn
    name = name.replace(/,|\+|\"|\\|\>|\<|\;|\r|\n|=|\//g,' ');
    name = name.replace(/^[# ]*|[# ]*$/g,'');
    name = name.toLowerCase();

    var cn = "cn=" + name + ", " + config.basedn;
    try {
      var dn = ldap.parseDN(cn);
    } catch (err) {
      // skip still invalid dn
      _debug("Skipping invalid CN. Name: " + name);
      continue;
    }

    _debug("Adding CN: "+cn);
    var obj = { dn: cn, attributes: {objectclass: [ "inetOrgPerson" ], cn: name,sn: name, givenName: name } };
    if (contacts[i].workphone) {
        obj.attributes.telephoneNumber = contacts[i].workphone;
    }
    if (contacts[i].cellphone) {
        obj.attributes.mobile = contacts[i].cellphone;
    }
    if (contacts[i].homephone) {
        obj.attributes.homePhone = contacts[i].homephone;
    }

    if (company) {
        obj.attributes.o = company;
    }

    addrbooks.push(obj);
  }
  // disconnect mysql
  db.end();

  var userinfo = {};
  if (authentication) {
    userinfo["cn=" + config.username + ", " + config.basedn] = {
      pwd: config.password,
      addrbooks: addrbooks
    }
  } else {
    userinfo["cn=anonymous"] = {
      addrbooks: addrbooks
    }
  }

  server.bind(config.basedn, function (req, res, next) {
    if (authentication) {
      var username = req.dn.toString(),
        password = req.credentials;
      if (!userinfo.hasOwnProperty(username) ||
         userinfo[username].pwd != password) {
         _debug("request username: " + username);
         _debug("request password: " + password);
        return next(new ldap.InvalidCredentialsError());
      }
    }

    res.end();
    return next();
  });

  server.search(config.basedn, function(req, res, next) {
    var binddn;
    if (authentication) {
      binddn = req.connection.ldap.bindDN.toString();
    } else {
      binddn = "cn=anonymous";
    }
    // Gigaset workaround
    if (req.filter == '(objectclass=*)') {
      for (index = 0; index < req.baseObject.rdns.length; ++index) {
        if (req.baseObject.rdns[index].attrs.cn && req.baseObject.rdns[index].attrs.cn.value) {
          req.filter = new ldap.EqualityFilter({
            attribute: 'cn',
            value: req.baseObject.rdns[index].attrs.cn.value
          });
          _debug("Query filter changed");
          break;
        }
      }
    }
    _debug("Query from " + req.connection.remoteAddress + ":" + req.filter);
    sent = 0;

    // Lowercase search parameters
    req.filter = lowercaseSearchParameters(req.filter);
    for (var i = 0; i < userinfo[binddn].addrbooks.length; i++) {
      if (req.filter.matches(userinfo[binddn].addrbooks[i].attributes)) {
        if ((config.limit > 0 && sent >= config.limit) || (req.sizeLimit > 0 && sent >= req.sizeLimit)) {
            break;
        } else {
            res.send(userinfo[binddn].addrbooks[i]);
            sent++;
        }
      }
    }
    res.end();
  });

  server.listen(config.port, function() {
    console.log("phonebook.js started at " + server.url);
    process.setgid(config.group);
    process.setuid(config.user);
  });
});
