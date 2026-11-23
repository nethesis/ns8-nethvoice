/**
 * Provides configuration manager functions through REST API.
 *
 * @module com_profiling_rest
 * @submodule plugins_rest
 */
var moment = require('moment');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins_rest/profiling]
 */
var IDLOG = '[plugins_rest/profiling]';

/**
 * The logger. It must have at least three methods: _info, warn and error._
 *
 * @property logger
 * @type object
 * @private
 * @default console
 */
var logger = console;

/**
 * The profiling architect component.
 *
 * @property compProfiling
 * @type object
 * @private
 */
var compProfiling;

/**
 * The configuration architect component.
 *
 * @property compConfigManager
 * @type object
 * @private
 */
var compConfigManager;

/**
 * The database architect component.
 *
 * @property compDbConn
 * @type object
 * @private
 */
var compDbConn;

/**
 * The utility architect component.
 *
 * @property compUtil
 * @type object
 * @private
 */
var compUtil;

/**
 * Set the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object. It must have at least three methods: _info, warn and error_ as console object.
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object' &&
      typeof log.log.info === 'function' &&
      typeof log.log.warn === 'function' &&
      typeof log.log.error === 'function') {

      logger = log;
      logger.log.info(IDLOG, 'new logger has been set');

    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the profiling architect component.
 *
 * @method setCompProfiling
 * @param {object} comp The profiling architect component.
 */
function setCompProfiling(comp) {
  try {
    compProfiling = comp;
    logger.log.info(IDLOG, 'set profiling architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the database architect component.
 *
 * @method setCompDbConn
 * @param {object} comp The database architect component.
 */
function setCompDbConn(comp) {
  try {
    compDbConn = comp;
    logger.log.info(IDLOG, 'set database architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the configuration architect component.
 *
 * @method setCompConfigManager
 * @param {object} comp The configuration architect component.
 */
function setCompConfigManager(comp) {
  try {
    compConfigManager = comp;
    logger.log.info(IDLOG, 'set configuration architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the utility architect component.
 *
 * @method setCompUtil
 * @param {object} comp The utility architect component.
 */
function setCompUtil(comp) {
  try {
    compUtil = comp;
    logger.log.info(IDLOG, 'set util architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

(function () {
  try {
    /**
        * REST plugin that provides profiling functions through the following REST API:
        *
        * # GET requests
        *
        * 1. [`profiling/all`](#allget)
        * 1. [`profiling/proc_mem`](#proc_memget)
        * 1. [`profiling/db_stats`](#db_statsget)
        * 1. [`profiling/tot_users`](#tot_usersget)
        * 1. [`profiling/conn_clients`](#conn_clientsget)
        *
        *
        * ---
        *
        * ### <a id="allget">**`profiling/all`**</a>
        *
        * Returns all the profiling data.
        *
        * Example JSON response:
        *
        *     {
         "pid": 23511,
         "uptime": "0 Days - 00:00:04",
         "node_ver": "v6.12.10",
         "pkg_ver": {
             "nethcti3": "nethcti3-3.0.5-1.ns7.noarch",
             "nethcti-server3": "nethcti-server3-3.0.4-1.ns7.x86_64",
             "janus-gateway": "janus-gateway-0.2.5-1.ns7.x86_64",
             "nethserver-nethvoice14": "nethserver-nethvoice14-14.0.9-1.ns7.noarch"
         },
         "proc_mem": {
             "rss": 96485376,
             "heapTotal": 77611008,
             "heapUsed": 55147992,
             "external": 2382791
         },
         "db_stats": {
             "numExecQueries": 7
         },
         "tot_users": 7,
         "conn_clients": {
             "ws_conn_clients": 1,
             "tcp_conn_clients": {
                 "tot": 2,
                 "<3.0.0": 1,
                 "3.0.0": 1
             }
         }
     }
        *
        * ---
        *
        * ### <a id="proc_memget">**`profiling/proc_mem`**</a>
        *
        * Returns the quantity of the memory used by the process in byte.
        *
        * Example JSON response:
        *
        *     {
         "rss": 66650112,
         "heapTotal": 43016192,
         "heapUsed": 36679920,
         "external": 4317024
     }
        *
        * ---
        *
        * ### <a id="conn_clientsget">**`profiling/conn_clients`**</a>
        *
        * Returns the number of connected clients.
        *
        * Example JSON response:
        *
        *     {
          "ws_conn_clients": 4,
          "tcp_conn_clients": {
              "tot": 2,
              "<3.0.0": 1,
              "3.0.0": 1
         }
     }
        *
        * ---
        *
        * ### <a id="db_statsget">**`profiling/db_stats`**</a>
        *
        * Returns the database statistics.
        *
        * Example JSON response:
        *
        *     { "num_exec_queries": 151 }
        *
        * @class plugin_rest_profiling
        * @static
        */
    var profiling = {

      // the REST api
      api: {
        'root': 'profiling',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property get
         * @type {array}
         *
         *   @param {string} all          To get all the profiling data
         *   @param {string} proc_mem     To get the quantity of the memory usage by the process
         *   @param {string} db_stats     To get the database statistics
         *   @param {string} conn_clients To get the number of connected clients
         */
        'get': [
          'all',
          'proc_mem',
          'db_stats',
          'tot_users',
          'conn_clients'
        ],

        'post': [],
        'head': [],
        'del': []
      },

      /**
       * Get all the profiling data by the following REST API:
       *
       *     all
       *
       * @method all
       * @param {object}   req The client request
       * @param {object}   res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      all: function (req, res, next) {
        try {
          var username = req.headers.authorization_user;
          compProfiling.getCtiPackageRelease(function (err1, result) {
            try {
              if (err1) {
                logger.log.error(IDLOG, err1);
                compUtil.net.sendHttp500(IDLOG, res, err1);
              } else {
                logger.log.info(IDLOG, 'send process data to user "' + username + '"');

                // calculate the uptime
                var uptime = '';
                var durationSec = Math.ceil(process.uptime());
                var uptimeSec = moment.duration(durationSec, 'seconds').seconds();
                var uptimeMin = moment.duration(durationSec, 'seconds').minutes();
                var uptimeHours = moment.duration(durationSec, 'seconds').hours();
                var uptimeDays = moment.duration(durationSec, 'seconds').days();
                var uptimeMonths = moment.duration(durationSec, 'seconds').months();
                var uptimeYears = moment.duration(durationSec, 'seconds').years();
                if (uptimeSec < 10) {
                  uptimeSec = '0' + uptimeSec;
                }
                if (uptimeMin < 10) {
                  uptimeMin = '0' + uptimeMin;
                }
                if (uptimeHours < 10) {
                  uptimeHours = '0' + uptimeHours;
                }
                if (uptimeYears > 0) {
                  uptime += uptimeYears + ' Years ';
                }
                if (uptimeYears > 0 || uptimeMonths > 0) {
                  uptime += uptimeMonths + ' Months ';
                }
                uptime += uptimeDays + ' Days - ' + uptimeHours + ':' + uptimeMin + ':' + uptimeSec;

                var result = {
                  pid: compProfiling.getProcessPid(),
                  uptime: uptime,
                  pkg_ver: result,
                  node_ver: compProfiling.getNodeVersion(),
                  proc_mem: compProfiling.getProcMem(),
                  db_stats: compDbConn.getStats(),
                  tot_users: compConfigManager.getTotNumUsers(),
                  conn_clients: getConnectedClientsNum(),
                  hostname: compProfiling.getHostname(),
                  publichost: compProfiling.getPublichost(),
                  server_time: compProfiling.getServerTime()
                };
                res.send(200, result);
              }
            } catch (err2) {
              logger.log.error(IDLOG, err2.stack);
              compUtil.net.sendHttp500(IDLOG, res, err2.toString());
            }
          });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Get the quantity of the memory usage by the process by the following REST API:
       *
       *     proc_mem
       *
       * @method all
       * @param {object}   req The client request
       * @param {object}   res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      proc_mem: function (req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var results = compProfiling.getProcMem();

          if (typeof results !== 'object') {
            var strerr = 'wrong mem usage result for user "' + username + '"';
            logger.log.error(IDLOG, strerr);
            compUtil.net.sendHttp500(IDLOG, res, strerr);

          } else {

            logger.log.info(IDLOG, 'send mem usage data to user "' + username + '"');
            res.send(200, results);
          }

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Gets the number of connected clients with the following REST API:
       *
       *     conn_clients
       *
       * @method conn_clients
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      conn_clients: function (req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var results = getConnectedClientsNum();

          if (typeof results !== 'object') {
            var strerr = 'wrong connected clients number result for user "' + username + '"';
            logger.log.error(IDLOG, strerr);
            compUtil.net.sendHttp500(IDLOG, res, strerr);

          } else {

            logger.log.info(IDLOG, 'send connected clients number data to user "' + username + '"');
            res.send(200, results);
          }

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Gets the number of executed queries with the following REST API:
       *
       *     db_stats
       *
       * @method db_stats
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      db_stats: function (req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var results = compDbConn.getStats();

          if (typeof results !== 'object') {
            var strerr = 'wrong executed queries number result for user "' + username + '"';
            logger.log.error(IDLOG, strerr);
            compUtil.net.sendHttp500(IDLOG, res, strerr);

          } else {

            logger.log.info(IDLOG, 'send executed queries number data to user "' + username + '"');
            res.send(200, results);
          }

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      }
    }
    exports.api = profiling.api;
    exports.all = profiling.all;
    exports.proc_mem = profiling.proc_mem;
    exports.db_stats = profiling.db_stats;
    exports.setLogger = setLogger;
    exports.setCompUtil = setCompUtil;
    exports.conn_clients = profiling.conn_clients;
    exports.setCompDbConn = setCompDbConn;
    exports.setCompProfiling = setCompProfiling;
    exports.setCompConfigManager = setCompConfigManager;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();

/**
 * Returns the number of connected clients.
 *
 * @method getConnectedClientsNum
 * @private
 * @return {object} The number of connected clients by websocket and tcp.
 */
function getConnectedClientsNum() {
  try {
    return {
      ws_conn_clients: compProfiling.getWsNumConnectedClients(),
      tcp_conn_clients: compProfiling.getTcpNumConnectedClients()
    };
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}
