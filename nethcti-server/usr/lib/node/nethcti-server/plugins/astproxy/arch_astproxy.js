/**
 * The architect component that exposes _astproxy_ module.
 *
 * @class arch_astproxy
 */
const fs = require('fs');
const http = require('http');
const https = require('https');
const moment = require('moment');
const astProxy = require('@nethesis/astproxy');
var queueRecallingManager = astProxy.queueRecallingManager;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_astproxy]
 */
var IDLOG = '[arch_astproxy]';

/**
 * The interval time to update nullCallPeriod.
 *
 * @property INTERVAL_UPDATE_NULLCALLPERIOD
 * @type number
 * @private
 * @final
 * @readOnly
 * @default 60000
 */
const INTERVAL_UPDATE_NULLCALLPERIOD = 60000;

/**
 * The database component.
 *
 * @property compDbconn
 * @type object
 * @private
 */
var compDbconn;

/**
 * Statistics about queues calls. It is updated once every half an hour.
 *
 * @property qCallsStatsHist
 * @type object
 * @private
 */
var qCallsStatsHist = {};

/**
 * NethVoice report configurations.
 *
 * @property nvReportConf
 * @type object
 * @private
 */
let nvReportConf;

/**
 * Null Call Period value used by stats.
 *
 * @property nullCallPeriod
 * @type number
 * @private
 */
let nullCallPeriod = 5;

var compAuthentication;

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger.ctilog;
  }
  compDbconn = imports.dbconn;
  compAuthentication = imports.authentication;

  /**
   * Return true if the PIN has been enabled on at least one outbound route.
   *
   * @method isPinEnabledAtLeastOneRoute
   * @param {function} cb The callback function
   * @return {boolean} True if the PIN has been enabled on at least one outbound route.
   */
  function isPinEnabledAtLeastOneRoute(cb) {
    try {
      compDbconn.isPinEnabledAtLeastOneRoute(cb);
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Return the JSON representation of queue statistics.
   *
   * @method getJSONQueueStats
   * @param {string} qid The queue identifier
   * @param {function} cb The callback function
   * @return {object} The JSON representation of extended queue statistics.
   */
  function getJSONQueueStats(qid, cb) {
    try {
      if (typeof qid !== 'string' || typeof cb !== 'function') {
        throw new Error('wrong parameters: ' + JSON.stringify(arguments));
      }
      var queues = astProxy.proxyLogic.getQueues();
      if (!queues[qid]) {
        var msg = 'getting JSON stats of queue "' + qid + '": queue does not exist';
        logger.log.warn(IDLOG, msg);
        cb(msg);
        return;
      }
      var staticDataQueues = astProxy.proxyLogic.getStaticDataQueues();
      if (!staticDataQueues[qid] || !staticDataQueues[qid].sla) {
        var msg = 'getting JSON stats of queue "' + qid + '": no static data about the queue';
        logger.log.warn(IDLOG, msg);
        cb(msg);
        return;
      }
      compDbconn.getQueueStats(qid, nullCallPeriod, staticDataQueues[qid].sla, function (err1, result) {
        cb(err1, result);
      });
    } catch (error) {
      logger.log.error(IDLOG, error.stack);
      cb(error);
    }
  }

  /**
   * Return the JSON representation of agents statistics.
   *
   * @method getJSONAllAgentsStats
   * @param {array} qlist The queue identifiers
   * @param {function} cb The callback function
   * @return {object} The JSON representation of queue agents statistics.
   */
  function getJSONAllAgentsStats(qlist, cb) {
    try {
      if (Array.isArray(qlist) === false || typeof cb !== 'function') {
        throw new Error('wrong parameters: ' + JSON.stringify(arguments));
      }
      var q, i, m;
      var temp;
      var allAgents = {};
      var queues = astProxy.proxyLogic.getQueues();
      // get all agents from all queues
      for (q in queues) {
        if (queues[q] === undefined) {
          continue;
        }
        temp = queues[q].getAllMembers();
        for (m in temp) {
          if (!allAgents[temp[m].getName()]) {
            allAgents[temp[m].getName()] = {};
          }
          allAgents[temp[m].getName()][q] = {
            isInPause: temp[m].isInPause(),
            isLoggedIn: temp[m].isLoggedIn()
          };
        }
      }
      var permittedAgents = {};
      // get permitted agents
      for (i = 0; i < qlist.length; i++) {
        if (queues[qlist[i]] === undefined) {
          continue;
        }
        temp = queues[qlist[i]].getAllMembers();
        for (var m in temp) {
          if (!permittedAgents[temp[m].getName()]) {
            permittedAgents[temp[m].getName()] = true;
          }
        }
      }
      compDbconn.getAgentsStatsByList(
        allAgents,
        function (err1, result) {
          for (var u in result) {
            if (!permittedAgents[u]) {
              // remove not permitted agents from result
              delete result[u];
            } else {
              for (var q in result[u]) {
                if (qlist.indexOf(q) === -1 && q !== 'incomingCalls' && q !== 'outgoingCalls' && q !== 'allCalls' && q !== 'allQueues') {
                  delete result[u][q];
                }
              }
            }
          }
          cb(err1, result);
        },
        qlist
      );
    } catch (error) {
      logger.log.error(IDLOG, error.stack);
      cb(error);
    }
  }

  /**
   * Return history of stasts of queues calls. Updates data once every half an hour.
   *
   * @method getQCallsStatsHist
   * @param {function} cb The callback function
   * @return {object} The JSON statistics about all queues.
   */
  function getQCallsStatsHist(cb) {
    try {
      if (typeof cb !== 'function') {
        throw new Error('wrong parameters: ' + JSON.stringify(arguments));
      }
      if (qCallsStatsHist.last) {
        var now = moment();
        var dd = now.format('DD');
        var HH = now.format('HH');
        var mm = now.format('mm');
        mm = parseInt(mm/30)*30;
        var newdate = dd + '-' + HH + ':' + mm;
        if (qCallsStatsHist.last === newdate) {
          logger.log.info(IDLOG, 'return cached history of queues calls stats');
          cb(null, qCallsStatsHist.data, qCallsStatsHist.len);
          return;
        }
      }
      compDbconn.getQCallsStatsHist(nullCallPeriod, function (err1, result, len) {
        var now = moment();
        var dd = now.format('DD');
        var HH = now.format('HH');
        var mm = now.format('mm');
        mm = parseInt(mm/30)*30;
        qCallsStatsHist.data = result;
        qCallsStatsHist.len = len;
        qCallsStatsHist.last = dd + '-' + HH + ':' + mm;
        logger.log.info(IDLOG, 'return updated history of queues calls stats');
        cb(err1, qCallsStatsHist.data, len);
      });
    } catch (error) {
      logger.log.error(IDLOG, error.stack);
      cb(error);
    }
  }

  /**
   * Get pin of extensions.
   *
   * @method getPinExtens
   * @param {array} extens The extension list
   * @param {function} cb The callback
   */
  function getPinExtens(extens, cb) {
    try {
      compDbconn.getPinExtens(extens, cb);
    } catch (e) {
      logger.log.error(IDLOG, e.stack);
    }
  }

  /**
   * Set pin for the extension.
   *
   * @method setPinExten
   * @param {string} extension The extension identifier
   * @param {string} pin The pin number to be set
   * @param {boolean} enabled True if the pin has to be enabled on the phone
   * @param {function} cb The callback
   */
  function setPinExten(extension, pin, enabled, cb) {
    try {
      compDbconn.setPinExten(extension, pin, enabled, cb);
    } catch (e) {
      logger.log.error(IDLOG, e.stack);
    }
  }

  /**
   * Returns the recall data about the queues.
   *
   * @method getRecallData
   * @param {object} obj
   *   @param {string} obj.hours The amount of hours of the current day to be searched
   *   @param {array} obj.queues The queue identifiers
   *   @param {type} obj.type It can be ("lost"|"done"|"all"). The type of call to be retrieved
   *   @param {integer} obj.offset The results offset
   *   @param {integer} obj.limit The results limit
   * @param {function} cb The callback function
   */
  function getRecallData(obj, cb) {
    try {
      if (typeof obj !== 'object' || !obj.queues || !obj.type || !obj.hours) {
        throw new Error('wrong parameters: ' + JSON.stringify(arguments));
      }
      obj.agents = astProxy.proxyLogic.getAgentsOfQueues(obj.queues);
      compDbconn.getRecall(obj, cb);
    } catch (error) {
      logger.log.error(IDLOG, error.stack);
      cb(error);
    }
  }

  /**
   * Returns the details about the queue recall of the caller id.
   *
   * @method getQueueRecallInfo
   * @param {string} hours The amount of hours of the current day to be searched
   * @param {string} cid The caller identifier
   * @param {string} qid The queue identifier
   * @param {function} cb The callback function
   */
  function getQueueRecallInfo(hours, cid, qid, cb) {
    try {
      if (typeof cid !== 'string' ||
        typeof cb !== 'function' ||
        typeof qid !== 'string' ||
        typeof hours !== 'string') {

        throw new Error('wrong parameters');
      }
      compDbconn.getQueueRecallInfo({
          hours: hours,
          cid: cid,
          qid: qid,
          agents: astProxy.proxyLogic.getAgentsOfQueues([qid])
        },
        function (err, results) {
          cb(err, results);
        });
    } catch (error) {
      logger.log.error(IDLOG, error.stack);
      callback(error);
    }
  }

  /**
   * Reload the component.
   *
   * @method reload
   */
  function reload() {
    try {
      astProxy.proxyLogic.setReloading(true);
      astProxy.reset();
      nethvoiceReportConfig();
      asteriskConfiguration();
      asteriskObjectsConfiguration();
      extenNamesConfiguration();
      astProxy.proxyLogic.start();
      logger.log.warn(IDLOG, 'reloaded');
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Asterisk configuration.
   *
   * @method asteriskConfiguration
   */
  function asteriskConfiguration() {
    try {
      const AST_CONF_FILEPATH = '/etc/nethcti/asterisk.json';
      let json = JSON.parse(fs.readFileSync(AST_CONF_FILEPATH, 'utf8'));
      if (typeof json.user !== 'string' ||
        typeof json.auto_c2c !== 'string' ||
        typeof json.pass !== 'string' || typeof json.prefix !== 'string' ||
        typeof json.host !== 'string' || typeof json.port !== 'string') {

        throw new Error(AST_CONF_FILEPATH + ' wrong file format');
      }
      let astConf = {
        port: json.port,
        host: json.host,
        username: json.user,
        password: json.pass,
        prefix: json.prefix,
        qm_alarms_notifications: json.qm_alarms_notifications,
        auto_c2c: json.auto_c2c,
        null_call_period: json.null_call_period,
        trunks_events: json.trunks_events,
        reconnect: true, // do you want the ami to reconnect if the connection is dropped, default: false
        reconnect_after: 3000 // how long to wait to reconnect, in miliseconds, default: 3000
      };
      astProxy.config(astConf);
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * NethVoice report configuration.
   *
   * @method nethvoiceReportConfig
   */
  function nethvoiceReportConfig() {
    try {
      const NVREPORT_CONF_FILEPATH = '/opt/nethvoice-report/api/conf.json';
      let json = JSON.parse(fs.readFileSync(NVREPORT_CONF_FILEPATH, 'utf8'));
      if (typeof json.api_key !== 'string' || typeof json.api_endpoint !== 'string') {
        throw new Error(NVREPORT_CONF_FILEPATH + ' wrong file format');
      }
      nvReportConf = {
        api_key: json.api_key,
        api_endpoint: json.api_endpoint,
      };
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Read nullCallPeriod value from NethVoice report configuration every minute.
   *
   * @method startReadingNullCallPeriod
   */
  async function startReadingNullCallPeriod() {
    try {
      logger.log.info(IDLOG, `starting default value nullCallPeriod is: ${nullCallPeriod}`);
      getNullCallPeriod();
      setInterval(getNullCallPeriod, INTERVAL_UPDATE_NULLCALLPERIOD);
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Read nullCallPeriod value from NethVoice report configuration.
   *
   * @method getNullCallPeriod
   */
  function getNullCallPeriod() {
    try {
      (async function exec() {
        if (nvReportConf.token === undefined) {
          try {
            const token = await makeNVReportLogin();
            nvReportConf.token = token;
          } catch (error) {
            logger.log.warn(IDLOG, error);
            nvReportConf.token = undefined;
          }
        }
        if (nvReportConf.token !== undefined) {
          try {
            nullCallPeriod = await getNVReportSettings();
            logger.log.info(IDLOG, `nullCallPeriod updated getting it from nethvoice-report: ${nullCallPeriod}`);
          } catch (error) {
            logger.log.warn(IDLOG, error);
            nvReportConf.token = undefined;
          }
        }
      })(); 
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Make login on NethVoice report.
   *
   * @method makeNVReportLogin
   */
  function makeNVReportLogin() {
    try {
      return new Promise((resolve, reject) => {
        if (nvReportConf.api_endpoint && typeof nvReportConf.api_endpoint === 'string' && nvReportConf.api_endpoint !== '') {
          let url = new URL(nvReportConf.api_endpoint);
          const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + '/login',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          };
          const req = http.request(options, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              data = JSON.parse(data);
              if (data.code === 200) {
                resolve(data.token);
              } else {
                reject(`logging-in to nethvoice-report - resp code: ${res.statusCode} - req: ${JSON.stringify(options)}`);
              }
            });
          });
          req.on('error', (e) => {
            reject(`problem logging in to nethvoice report with request: ${e.message}`);
          });
          req.write(JSON.stringify({ username: 'X', password: nvReportConf.api_key }));
          req.end(); 
        } else {
          reject('wrong configuration to login to nethvoice report: ' + JSON.stringify(nvReportConf));
        }
      });
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Get NethVoice report settings to read NullCallPeriod.
   *
   * @method getNVReportSettings
   */
  function getNVReportSettings() {
    try {
      return new Promise((resolve, reject) => {
        if (nvReportConf.token && typeof nvReportConf.token === 'string' && nvReportConf.token !== '') {
          let url = new URL(nvReportConf.api_endpoint);
          const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + '/settings',
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${nvReportConf.token}`
            }
          };
          const req = http.request(options, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              data = JSON.parse(data);
              if (data && data.settings && data.settings.null_call_time && data.settings.null_call_time !== '') {
                resolve(parseInt(data.settings.null_call_time));
              } else {
                reject('wrong nullCallPeriod from nethvoice report: ' + JSON.stringify(data) + ' for req ' + JSON.stringify(options));
              }
            });
          });
          req.on('error', (e) => {
            reject(`problem getting nullCallPeriod from nethvoice report with request: ${e.message}`);
          });
          req.end(); 
        } else {
          reject(`problem getting nullCallPeriod from nethvoice report: ${nvReportConf}`);
        }
      });
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Asterisk objects configuration.
   *
   * @method asteriskObjectsConfiguration
   */
  function asteriskObjectsConfiguration() {
    try {
      const AST_OBJECTS_FILEPATH = '/etc/nethcti/ast_objects.json';
      json = JSON.parse(fs.readFileSync(AST_OBJECTS_FILEPATH, 'utf8'));
      if (typeof json.trunks !== 'object' || typeof json.queues !== 'object') {
        throw new Error(AST_OBJECTS_FILEPATH + ' wrong file format');
      }
      astProxy.configAstObjects(json);
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Extensions names configuration.
   *
   * @method extenNamesConfiguration
   */
  function extenNamesConfiguration() {
    try {
      const USERS_CONF_FILEPATH = '/etc/nethcti/users.json';
      json = JSON.parse(fs.readFileSync(USERS_CONF_FILEPATH, 'utf8'));
      if (typeof json !== 'object') {
        throw new Error(USERS_CONF_FILEPATH + ' wrong file format');
      }
      astProxy.configExtenNames(json);
    } catch (err) {
      logger.log.error(IDLOG, err.stack);
    }
  }

  /**
   * Reload the configuration of physical phones using freepbx api.
   *
   * @method reloadPhysicalPhoneConfig
   * @param {object} extens Keys are extensions
   */
  function reloadPhysicalPhoneConfig(extens) {
    try {
      logger.log.info(IDLOG, `reload config of physical phones ${Object.keys(extens)}`);
      const secretKey = compAuthentication.getAdminSecretKey();
      const options = {
        hostname: 'localhost',
        port: 443,
        path: '',
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          'User': 'admin',
          'Secretkey': secretKey,
          'Content-Type': 'application/json'
        }
      }
      let req;
      for (let eid in extens) {
        options.path = '/freepbx/rest/devices/phones/reload/' + eid;
        req = https.request(options, res => {
          if (res && res.statusCode === 202) {
            logger.log.info(IDLOG, `sent HTTP POST req to reload config of physical phone "${eid}"`);
          } else if (res.statusCode !== 403 && res.statusCode !== 501) {
            logger.log.warn(IDLOG, `error sending HTTP POST req to reload config of physical phone "${eid}": ${res.statusCode}`);
          }
        });
        req.on('error', error => {
          logger.log.error(IDLOG, `error sending HTTP POST req to reload config of physical phone "${eid}": ${error.toString()}`);
        })
        req.end();
      }
    } catch (e) {
      logger.log.error(IDLOG, e.stack);
    }
  }

  // public interface for other architect components
  register(null, {
    astProxy: {
      reload: reload,
      on: astProxy.on,
      doCmd: astProxy.doCmd,
      setCfb: astProxy.proxyLogic.setCfb,
      setCfu: astProxy.proxyLogic.setCfu,
      getAlarms: astProxy.proxyLogic.getAlarms,
      getSipWebrtcConf: astProxy.getSipWebrtcConf,
      createAlarm: astProxy.proxyLogic.createAlarm,
      opWaitConv: astProxy.proxyLogic.opWaitConv,
      deleteAlarm: astProxy.proxyLogic.deleteAlarm,
      getConference: astProxy.proxyLogic.getConference,
      pickupQueueWaitingCaller: astProxy.proxyLogic.pickupQueueWaitingCaller,
      getEchoCallDestination: astProxy.proxyLogic.getEchoCallDestination,
      getMeetmeConfCode: astProxy.proxyLogic.getMeetmeConfCode,
      isPinEnabledAtLeastOneRoute: isPinEnabledAtLeastOneRoute,
      getUserExtenIdFromConf: astProxy.proxyLogic.getUserExtenIdFromConf,
      unmuteUserMeetmeConf: astProxy.proxyLogic.unmuteUserMeetmeConf,
      hangupUserMeetmeConf: astProxy.proxyLogic.hangupUserMeetmeConf,
      endMeetmeConf: astProxy.proxyLogic.endMeetmeConf,
      setAllExtensionsUsername: astProxy.proxyLogic.setAllExtensionsUsername,
      getUsernameByExtension: astProxy.proxyLogic.getUsernameByExtension,
      muteUserMeetmeConf: astProxy.proxyLogic.muteUserMeetmeConf,
      isExtenInMeetmeConf: astProxy.proxyLogic.isExtenInMeetmeConf,
      setUnconditionalCfVm: astProxy.proxyLogic.setUnconditionalCfVm,
      setCfbVm: astProxy.proxyLogic.setCfbVm,
      setCfuVm: astProxy.proxyLogic.setCfuVm,
      startMeetmeConference: astProxy.proxyLogic.startMeetmeConference,
      setUnconditionalCf: astProxy.proxyLogic.setUnconditionalCf,
      getExtensions: astProxy.proxyLogic.getExtensions,
      isExtenOnline: astProxy.proxyLogic.isExtenOnline,
      getExtenStatus: astProxy.proxyLogic.getExtenStatus,
      getExtensionAgent: astProxy.proxyLogic.getExtensionAgent,
      getExtensionIp: astProxy.proxyLogic.getExtensionIp,
      getPrefix: astProxy.proxyLogic.getPrefix,
      addPrefix: astProxy.proxyLogic.addPrefix,
      isTrunk: astProxy.proxyLogic.isTrunk,
      isExten: astProxy.proxyLogic.isExten,
      hangupChannel: astProxy.proxyLogic.hangupChannel,
      hangupConversation: astProxy.proxyLogic.hangupConversation,
      hangupMainExtension: astProxy.proxyLogic.hangupMainExtension,
      forceHangupConversation: astProxy.proxyLogic.forceHangupConversation,
      startRecordConversation: astProxy.proxyLogic.startRecordConversation,
      stopRecordConversation: astProxy.proxyLogic.stopRecordConversation,
      muteRecordConversation: astProxy.proxyLogic.muteRecordConversation,
      unmuteRecordConversation: astProxy.proxyLogic.unmuteRecordConversation,
      parkConversation: astProxy.proxyLogic.parkConversation,
      redirectConversation: astProxy.proxyLogic.redirectConversation,
      redirectWaitingCaller: astProxy.proxyLogic.redirectWaitingCaller,
      redirectParking: astProxy.proxyLogic.redirectParking,
      attendedTransferConversation: astProxy.proxyLogic.attendedTransferConversation,
      blindTransferConversation: astProxy.proxyLogic.blindTransferConversation,
      transferConversationToVoicemail: astProxy.proxyLogic.transferConversationToVoicemail,
      call: astProxy.proxyLogic.call,
      extenHasConv: astProxy.proxyLogic.extenHasConv,
      muteConversation: astProxy.proxyLogic.muteConversation,
      unmuteConversation: astProxy.proxyLogic.unmuteConversation,
      sendDtmfToConversation: astProxy.proxyLogic.sendDtmfToConversation,
      pickupConversation: astProxy.proxyLogic.pickupConversation,
      pickupParking: astProxy.proxyLogic.pickupParking,
      inoutDynQueues: astProxy.proxyLogic.inoutDynQueues,
      getQCallsStatsHist: getQCallsStatsHist,
      queueMemberPauseUnpause: astProxy.proxyLogic.queueMemberPauseUnpause,
      queueMemberAdd: astProxy.proxyLogic.queueMemberAdd,
      queueMemberRemove: astProxy.proxyLogic.queueMemberRemove,
      startSpyListenConversation: astProxy.proxyLogic.startSpyListenConversation,
      startSpySpeakConversation: astProxy.proxyLogic.startSpySpeakConversation,
      getJSONExtension: astProxy.proxyLogic.getJSONExtension,
      getJSONExtensions: astProxy.proxyLogic.getJSONExtensions,
      getJSONQueues: astProxy.proxyLogic.getJSONQueues,
      getJSONAllQueuesStats: astProxy.proxyLogic.getJSONAllQueuesStats,
      getJSONAllAgentsStats: getJSONAllAgentsStats,
      evtConversationHold: astProxy.proxyLogic.evtConversationHold,
      evtConversationUnhold: astProxy.proxyLogic.evtConversationUnhold,
      getPinExtens: getPinExtens,
      setPinExten: setPinExten,
      getQMAlarmsNotificationsStatus: astProxy.proxyLogic.getQMAlarmsNotificationsStatus,
      setQMAlarmsNotificationsStatus: astProxy.proxyLogic.setQMAlarmsNotificationsStatus,
      getJSONQueueStats: getJSONQueueStats,
      getJSONTrunks: astProxy.proxyLogic.getJSONTrunks,
      getTrunksList: astProxy.proxyLogic.getTrunksList,
      getExtensList: astProxy.proxyLogic.getExtensList,
      getQueuesList: astProxy.proxyLogic.getQueuesList,
      getJSONParkings: astProxy.proxyLogic.getJSONParkings,
      sendDTMFSequence: astProxy.proxyLogic.sendDTMFSequence,
      getExtensionsFromConversation: astProxy.proxyLogic.getExtensionsFromConversation,
      getBaseCallRecAudioPath: astProxy.proxyLogic.getBaseCallRecAudioPath,
      getQueueIdsOfExten: astProxy.proxyLogic.getQueueIdsOfExten,
      recordAudioFile: astProxy.proxyLogic.recordAudioFile,
      isExtenDynMemberQueue: astProxy.proxyLogic.isExtenDynMemberQueue,
      isDynMemberLoggedInQueue: astProxy.proxyLogic.isDynMemberLoggedInQueue,
      CF_TYPES: astProxy.CF_TYPES,
      EXTEN_STATUS_ENUM: astProxy.proxyLogic.EXTEN_STATUS_ENUM,
      EVT_EXTEN_CHANGED: astProxy.proxyLogic.EVT_EXTEN_CHANGED,
      EVT_EXTEN_HANGUP: astProxy.proxyLogic.EVT_EXTEN_HANGUP,
      EVT_NEW_CDR: astProxy.proxyLogic.EVT_NEW_CDR,
      EVT_READY: astProxy.proxyLogic.EVT_READY,
      EVT_RELOADED: astProxy.proxyLogic.EVT_RELOADED,
      EVT_QUEUE_MEMBER_CHANGED: astProxy.proxyLogic.EVT_QUEUE_MEMBER_CHANGED,
      EVT_MEETME_CONF_END: astProxy.proxyLogic.EVT_MEETME_CONF_END,
      EVT_MEETME_CONF_CHANGED: astProxy.proxyLogic.EVT_MEETME_CONF_CHANGED,
      EVT_TRUNK_CHANGED: astProxy.proxyLogic.EVT_TRUNK_CHANGED,
      EVT_EXTEN_DIALING: astProxy.proxyLogic.EVT_EXTEN_DIALING,
      EVT_CALLIN_BY_TRUNK: astProxy.proxyLogic.EVT_CALLIN_BY_TRUNK,
      EVT_EXTEN_CONNECTED: astProxy.proxyLogic.EVT_EXTEN_CONNECTED,
      EVT_QUEUE_CHANGED: astProxy.proxyLogic.EVT_QUEUE_CHANGED,
      EVT_PARKING_CHANGED: astProxy.proxyLogic.EVT_PARKING_CHANGED,
      EVT_NEW_VOICE_MESSAGE: astProxy.proxyLogic.EVT_NEW_VOICE_MESSAGE,
      EVT_UPDATE_VOICE_MESSAGES: astProxy.proxyLogic.EVT_UPDATE_VOICE_MESSAGES,
      EVT_EXTEN_DND_CHANGED: astProxy.proxyLogic.EVT_EXTEN_DND_CHANGED,
      EVT_EXTEN_CF_CHANGED: astProxy.proxyLogic.EVT_EXTEN_CF_CHANGED,
      EVT_EXTEN_CFB_CHANGED: astProxy.proxyLogic.EVT_EXTEN_CFB_CHANGED,
      EVT_EXTEN_CFU_CHANGED: astProxy.proxyLogic.EVT_EXTEN_CFU_CHANGED,
      EVT_EXTEN_CFVM_CHANGED: astProxy.proxyLogic.EVT_EXTEN_CFVM_CHANGED,
      setAsteriskPresence: astProxy.proxyLogic.setAsteriskPresence,
      reloadPhysicalPhoneConfig: reloadPhysicalPhoneConfig,
      getPausedQueues: astProxy.proxyLogic.getPausedQueues,
      getExtenCfValue: astProxy.proxyLogic.getExtenCfValue,
      getExtenCfbValue: astProxy.proxyLogic.getExtenCfbValue,
      getExtenCfuValue: astProxy.proxyLogic.getExtenCfuValue,
      isExtenCf: astProxy.proxyLogic.isExtenCf,
      isExtenCfb: astProxy.proxyLogic.isExtenCfb,
      isExtenCfu: astProxy.proxyLogic.isExtenCfu,
      isExtenCfVm: astProxy.proxyLogic.isExtenCfVm,
      isExtenCfbVm: astProxy.proxyLogic.isExtenCfbVm,
      isExtenCfuVm: astProxy.proxyLogic.isExtenCfuVm,
      getExtenFromMac: astProxy.proxyLogic.getExtenFromMac,
      setDnd: astProxy.proxyLogic.setDnd,
      inCallAudio: astProxy.proxyLogic.inCallAudio,
      isExtenDnd: astProxy.proxyLogic.isExtenDnd,
      isAutoC2CEnabled: astProxy.proxyLogic.isAutoC2CEnabled,
      isC2CModeCloud: astProxy.proxyLogic.isC2CModeCloud,
      getC2CMode: astProxy.proxyLogic.getC2CMode,
      getRecallData: getRecallData,
      getQueueRecallInfo: getQueueRecallInfo,
      checkQueueRecallingStatus: queueRecallingManager.checkQueueRecallingStatus,
      recallOnBusy: astProxy.proxyLogic.recallOnBusy
    }
  });

  try {
    astProxy.setLogger(logger.log);
    nethvoiceReportConfig();
    startReadingNullCallPeriod();
    asteriskConfiguration();
    asteriskObjectsConfiguration();
    extenNamesConfiguration();
    astProxy.start();
    queueRecallingManager.setLogger(logger.log);
    queueRecallingManager.setCompAstProxy(astProxy);
  } catch (err) {
    logger.log.error(err.stack);
  }
};
