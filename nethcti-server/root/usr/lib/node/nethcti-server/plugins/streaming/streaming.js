/**
 * Provides the streaming functions.
 *
 * @module streaming
 * @main arch_streaming
 */

/**
 * Provides the streaming functionalities.
 *
 * @class streaming
 * @static
 */
var fs = require('fs');
var crypto = require('crypto');
var request = require('request');
var Streaming = require('./streaming_class').Streaming;
var deviceHttp = require('./device_http');
var EventEmitter = require('events').EventEmitter;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [streaming]
 */
var IDLOG = '[streaming]';

/**
 * The configuration file path.
 *
 * @property CONFIG_FILEPATH
 * @type string
 * @private
 */
var CONFIG_FILEPATH;

/**
 * Fired when the componente has been reloaded.
 *
 * @event reloaded
 */
/**
 * The name of the reloaded event.
 *
 * @property EVT_RELOADED
 * @type string
 * @default "reloaded"
 */
var EVT_RELOADED = 'reloaded';

/**
 * Fired when the streaming source has been sampled.
 *
 * @event streamingSourceChanged
 */
/**
 * The name of the streaming source update event.
 *
 * @property EVT_STREAMING_SOURCE_CHANGED
 * @type string
 * @default "streamingSourceUpdate"
 */
var EVT_STREAMING_SOURCE_CHANGED = 'streamingSourceChanged';

/**
 * Fired when the streaming source has been subscribed.
 *
 * @event streamingSourceSubscribed
 */
/**
 * The name of the streaming source subscribe event.
 *
 * @property EVT_STREAMING_SOURCE_SUBSCRIBED
 * @type string
 * @default "streamingSourceSubscribed"
 */
var EVT_STREAMING_SOURCE_SUBSCRIBED = 'streamingSourceSubscribed';

/**
 * Fired when the streaming source has been unsubscribed.
 *
 * @event streamingSourceUnsubscribed
 */
/**
 * The name of the streaming source unsubscribe event.
 *
 * @property EVT_STREAMING_SOURCE_UNSUBSCRIBED
 * @type string
 * @default "streamingSourceUnsubscribed"
 */
var EVT_STREAMING_SOURCE_UNSUBSCRIBED = 'streamingSourceUnsubscribed';

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
 * The identifier of the interval used to get the source samples.
 *
 * @property intervalGetSourceSample
 * @type number
 * @private
 */
var intervalGetSourceSample;

/**
 * The streaming objects. The keys are the streaming identifiers and the
 * values are the _Streaming_ objects. It is initialiazed by the _config_
 * function.
 *
 * @property streamings
 * @type object
 * @private
 * @default {}
 */
var streamings = {};

/**
 * The last error of the samples of each streaming source (its code, or its
 * text): an error is logged once, and again only when it changes (e.g. a
 * device that was off and now presents another certificate).
 *
 * @property streamings
 * @type object
 * @private
 * @default {}
 */
let streamingErrors = {};

/**
 * Returns true if the streaming source has at least one subscriber. Only the
 * sources with subscribers are sampled. By default all sources are sampled,
 * it is replaced by the websocket component using _setSubscribersChecker_.
 *
 * @property hasSubscribers
 * @type function
 * @private
 */
let hasSubscribers = function() { return true; };

/**
 * The lifetime in seconds of the tokens used to watch the RTSP sources
 * through the video gateway. A token opens a single gateway session: it is
 * bound to the first session the gateway authorizes with it, and a client
 * gets a new token for every connection.
 *
 * @property STREAM_TOKEN_TTL
 * @type number
 * @private
 * @default 60
 */
var STREAM_TOKEN_TTL = 60;

/**
 * The maximum number of valid tokens not used yet of a single user: the
 * oldest ones are dropped when it is exceeded.
 *
 * @property MAX_TOKENS_PER_USER
 * @type number
 * @private
 * @default 40
 */
var MAX_TOKENS_PER_USER = 40;

/**
 * The maximum number of concurrent video gateway sessions of a single user on
 * the same source (e.g. the CTI page and NethLink on two devices).
 *
 * @property MAX_SESSIONS_PER_SOURCE
 * @type number
 * @private
 * @default 3
 */
var MAX_SESSIONS_PER_SOURCE = 3;

/**
 * The maximum number of concurrent video gateway sessions of a single user on
 * all the sources.
 *
 * @property MAX_SESSIONS_PER_USER
 * @type number
 * @private
 * @default 30
 */
var MAX_SESSIONS_PER_USER = 30;

/**
 * The maximum number of tokens a single user can get in TOKEN_RATE_WINDOW
 * milliseconds. It is far above the normal use (a page with many sources,
 * several clients and their reconnections) and only stops a runaway client.
 *
 * @property TOKEN_RATE_LIMIT
 * @type number
 * @private
 * @default 300
 */
var TOKEN_RATE_LIMIT = 300;

/**
 * The window in milliseconds of TOKEN_RATE_LIMIT.
 *
 * @property TOKEN_RATE_WINDOW
 * @type number
 * @private
 * @default 60000
 */
var TOKEN_RATE_WINDOW = 60000;

/**
 * The age in milliseconds under which a session record is kept even if the
 * gateway does not list it yet (it is being authorized).
 *
 * @property SESSION_RECORD_GRACE
 * @type number
 * @private
 * @default 5000
 */
var SESSION_RECORD_GRACE = 5000;

/**
 * The user of the video gateway API (MediaMTX "api" action), authenticated
 * by the hook with the password of services.json.
 *
 * @property GATEWAY_API_USER
 * @type string
 * @private
 * @default "nethcti-server"
 */
var GATEWAY_API_USER = 'nethcti-server';

/**
 * The interval in milliseconds of the periodic check of the gateway
 * sessions (expired tokens, sessions closed by the gateway, sessions of users
 * that have lost the permission).
 *
 * @property GATEWAY_CHECK_INTERVAL
 * @type number
 * @private
 * @default 30000
 */
var GATEWAY_CHECK_INTERVAL = 30000;

/**
 * The age in milliseconds after which a gateway session without a record
 * (authorized before a restart of the server) is kicked.
 *
 * @property UNKNOWN_SESSION_GRACE
 * @type number
 * @private
 * @default 15000
 */
var UNKNOWN_SESSION_GRACE = 15000;

/**
 * The timeout in milliseconds of the requests to the video gateway API.
 *
 * @property GATEWAY_API_TIMEOUT
 * @type number
 * @private
 * @default 3000
 */
var GATEWAY_API_TIMEOUT = 3000;

/**
 * The timeout in milliseconds of the HTTP requests of the URL gates.
 *
 * @property GATE_URL_TIMEOUT
 * @type number
 * @private
 * @default 5000
 */
var GATE_URL_TIMEOUT = 5000;

/**
 * The maximum size in bytes of the response of a URL gate.
 *
 * @property GATE_MAX_BYTES
 * @type number
 * @private
 * @default 65536
 */
var GATE_MAX_BYTES = 64 * 1024;

/**
 * The valid tokens to watch the RTSP sources. The keys are the tokens and
 * the values are objects with "username", "sourceId", "expires" (timestamp
 * in milliseconds) and "sessionId" (the gateway session the token has been
 * used for, null while unused).
 *
 * @property streamTokens
 * @type object
 * @private
 */
var streamTokens = {};

/**
 * The timestamps of the tokens created by each user in the last
 * TOKEN_RATE_WINDOW milliseconds. The keys are the usernames.
 *
 * @property tokenRequests
 * @type object
 * @private
 */
var tokenRequests = {};

/**
 * The sessions authorized on the video gateway. The keys are the gateway
 * session identifiers and the values are objects with "username",
 * "sourceId", "created" and "token" (the token that opened it).
 *
 * @property gatewaySessions
 * @type object
 * @private
 */
var gatewaySessions = {};

/**
 * The base URL of the video gateway API, e.g. "http://127.0.0.1:20043".
 * If it is not configured the gateway sessions are not revoked.
 *
 * @property gatewayApiUrl
 * @type string
 * @private
 */
var gatewayApiUrl = null;

/**
 * The password of the video gateway API user (GATEWAY_API_USER), from
 * services.json. Without it the API is not used and the "api" action is
 * always denied by the hook.
 *
 * @property gatewayApiPassword
 * @type string
 * @private
 */
var gatewayApiPassword = null;

/**
 * The identifier of the interval of the periodic gateway check.
 *
 * @property intervalGatewayCheck
 * @type number
 * @private
 */
var intervalGatewayCheck;

/**
 * The timeout used to check the gateway sessions after a reload.
 *
 * @property timeoutGatewayCheck
 * @type number
 * @private
 */
var timeoutGatewayCheck;

/**
 * True if the last request to the gateway API failed: the error is logged
 * only once.
 *
 * @property gatewayApiFailing
 * @type boolean
 * @private
 */
var gatewayApiFailing = false;

/**
 * The authentication state of the URL gates. The keys are
 * "<source id>/<gate id>".
 *
 * @property gateAuthMemos
 * @type object
 * @private
 */
var gateAuthMemos = {};

/**
 * The asterisk proxy component used for asterisk functions.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * The authorization architect component used for customer card functions.
 *
 * @property compAuthorization
 * @type object
 * @private
 */
var compAuthorization;

/**
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * Set the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object. It must have at least
 * three methods: _info, warn and error_ as console object.
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object' && typeof log.log.info === 'function' && typeof log.log.warn === 'function' && typeof log.log.error === 'function') {

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
 * Sets the asterisk proxy component used for asterisk functions.
 *
 * @method setCompAstProxy
 * @param {object} ap The asterisk proxy component.
 */
function setCompAstProxy(ap) {
  try {
    compAstProxy = ap;
    logger.log.info(IDLOG, 'set asterisk proxy architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authorization architect component used by customer card functions.
 *
 * @method setCompAuthorization
 * @param {object} ca The authorization architect component.
 */
function setCompAuthorization(ca) {
  try {
    compAuthorization = ca;
    logger.log.info(IDLOG, 'set authorization architect component');
    // the users can lose the permission of a source: check the gateway sessions
    if (ca && typeof ca.on === 'function' && ca.EVT_RELOADED) {
      ca.on(ca.EVT_RELOADED, scheduleGatewayCheck);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * It reads the configuration file and creates new _Streaming_
 * objects. The file must use the JSON syntax.
 *
 * **The method can throw an Exception.**
 *
 * @method config
 * @param {string} path The path of the configuration file
 */
function config(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check file presence
    if (!fs.existsSync(path)) {
      logger.log.warn(IDLOG, path + ' doesn\'t exist');
      return;
    }
    CONFIG_FILEPATH = path;
    logger.log.info(IDLOG, 'configure streaming with ' + CONFIG_FILEPATH);

    // read configuration file
    var json = JSON.parse(fs.readFileSync(CONFIG_FILEPATH, 'utf8'));

    // check JSON file
    if (typeof json !== 'object') {
      throw new Error('wrong JSON file ' + CONFIG_FILEPATH);
    }

    // creates the Streaming objects and store them
    var id;
    var newStreaming;
    for (id in json) {
      // add the identifier to the current object. It's needed
      // to create the new Streaming object
      json[id].id = id;

      // create the new Streaming object
      newStreaming = new Streaming(json[id]);

      // memorize it
      streamings[id] = newStreaming;
      warnUnpinned(newStreaming);
    }

    logger.log.info(IDLOG, 'configured streaming sources: ' + Object.keys(streamings));
    logger.log.info(IDLOG, 'streaming configuration by file ' + CONFIG_FILEPATH + ' ended');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Logs the https:// devices of a source whose TLS verification is skipped
 * without a pinned certificate (source saved by an older version): they are
 * still contacted, but the administrator should save the source again to pin
 * the certificate of the device.
 *
 * @method warnUnpinned
 * @param {object} source The Streaming object
 * @private
 */
function warnUnpinned(source) {
  if (!source.getTlsSkipVerify()) {
    return;
  }
  var unpinned = [];
  if (source.getType() === 'image' && /^https:/i.test(source.getUrl() || '') && source.getTlsFingerprint() === null) {
    unpinned.push('snapshot URL');
  }
  var gates = source.getGates() || [];
  var i;
  for (i = 0; i < gates.length; i++) {
    if (gates[i].type === 'url' && /^https:/i.test(gates[i].url) && gates[i].tlsFingerprint === null) {
      unpinned.push('gate "' + gates[i].id + '"');
    }
  }
  if (unpinned.length > 0) {
    logger.log.warn(IDLOG, 'streaming source "' + source.getId() + '" skips the TLS verification without a pinned certificate (' +
      unpinned.join(', ') + '): save the source again in the NethVoice administration to pin the device certificate');
  }
}

/**
 * Start to sample video streaming sources each framerate.
 *
 * @method start
 */
function start() {
  try {
    logger.log.info(IDLOG, 'start sampling video sources.');
    var loopStep = 0;
    var baseTime = 500;
    intervalGetSourceSample = setInterval(function() {
      try {
        for (var i in streamings) {
          // the video of the RTSP sources is served by the video gateway
          if (streamings[i].getType() !== 'image') {
            continue;
          }
          if (loopStep % (streamings[i].getFramerate() / baseTime) === 0 && hasSubscribers(i)) {
            // emit the streaming source changed event
            streamings[i].getSample(function(err1, id, img) {
              try {
                if (err1) {
                  var kind = (err1 && typeof err1 === 'object') ? String(err1.code || err1.message) : String(err1);
                  if (streamingErrors[id] !== kind) {
                    streamingErrors[id] = kind;
                    logger.log.warn(IDLOG, 'streaming "' + id + '" error: ' + deviceHttp.describeError(err1));
                  }
                  return;
                }
                delete streamingErrors[id];
                logger.log.info(IDLOG, 'emit event "' + EVT_STREAMING_SOURCE_CHANGED + '"');
                emitter.emit(EVT_STREAMING_SOURCE_CHANGED, {
                  streaming: {
                    source: id,
                    image: img
                  }
                });
              } catch (err2) {
                logger.log.error(IDLOG, err2.stack);
              }
            });
          }
        }
      } catch (err2) {
        logger.log.error(IDLOG, err2.stack);
      }
      loopStep = (loopStep < 600 ? loopStep + 1 : 1);
    }, baseTime);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns all streaming sources for the user of empty object in error case.
 *
 * @method getAllStreamingSources
 * @param {string} extenId The extension endpoint identifier
 * @param {function} cb The callback function
 * @return {object} The streaming source in JSON format.
 */
function getAllStreamingSources(username, cb) {
  try {
    var i;
    var allowedStreamingSources = compAuthorization.getAllowedStreamingSources(username);
    var permissions = [];
    for (i in allowedStreamingSources) {
      permissions.push(allowedStreamingSources[i].name);
    }
    var results = {};
    for (i in streamings) {
      if (permissions.indexOf(i) >= 0) {
        results[i] = streamings[i].toJSON();
      }
    }
    cb(null, results);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err, {});
  }
}

/**
 * Executes the command associated with the streaming source to open
 * the associated device, e.g. a door, using the "open" code of the
 * configuration. It is used for the sources without gates (configuration
 * written by an older FreePBX).
 *
 * @method openLegacy
 * @param {string}   streamId The streaming source identifier
 * @param {string}   callerid The caller identifier
 * @param {string}   fromExten The extension of the user
 * @param {function} cb       The callback function
 * @private
 */
function openLegacy(streamId, callerid, fromExten, cb) {
  // get the open command of the streaming source
  var opencmd = streamings[streamId].getOpenCommand(streamId);
  // get the extension associated with the streaming source
  var exten = streamings[streamId].getExtension(streamId);

  // check the extension and the open command
  if (typeof exten !== 'string' || exten === '') {
    logger.log.warn(IDLOG, 'opening streaming source "' + streamId + '" with no extension');
  }
  if (typeof opencmd !== 'string' || opencmd === '') {
    logger.log.warn(IDLOG, 'opening streaming source "' + streamId + '" with no open command');
  }

  // sends the DTMF tones to the extension device associated
  // with the streaming source to open it
  compAstProxy.sendDTMFSequence(exten, opencmd, callerid, fromExten, function(err) {

    if (err) {
      logger.log.error(IDLOG, 'sending DTMF sequence to extension ' + exten + ': ' + err);
      cb(streamingError(502, 'dtmf_failed', 'sending the DTMF code to extension ' + exten + ' failed'));

    } else {
      logger.log.info(IDLOG, 'sending DTMF sequence to extension ' + exten + ' has been successful');
      cb(null);
    }
  });
}

/**
 * Returns an error object for the callers of the streaming functions.
 *
 * @method streamingError
 * @param {number} status The HTTP status code that describes the error
 * @param {string} code A short machine readable error code
 * @param {string} message The error message
 * @return {object} The error.
 * @private
 */
function streamingError(status, code, message) {
  var err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Returns the error for a DTMF gate of an extension whose call is not
 * answered yet.
 *
 * @method callNotAnsweredError
 * @param {string} exten The extension identifier
 * @return {object} The error.
 * @private
 */
function callNotAnsweredError(exten) {
  return streamingError(409, 'call_not_answered',
    'the call of extension ' + exten + ' is not answered yet: answer the call to send the DTMF code');
}

/**
 * Returns true if the extension is in a call that is not answered yet on
 * its side, i.e. it has at least one channel and none of them has the
 * "up" status. The DTMF played by the PBX on a channel that is still
 * ringing (incoming call: "ring", outgoing call: "down", "ringing", ...)
 * gets lost, even if Asterisk reports success. Without channels the DTMF
 * sequence calls the extension and sends the tones after the answer.
 *
 * @method isExtenCallNotAnswered
 * @param {string} exten The extension identifier
 * @return {boolean} True if the call of the extension is not answered yet.
 * @private
 */
function isExtenCallNotAnswered(exten) {
  if (typeof exten !== 'string' || exten === '' || !compAstProxy.isExten(exten)) {
    return false;
  }
  var convs = compAstProxy.getJSONExtension(exten).conversations || {};
  var found = false;
  var convid, chs, i, ch;
  for (convid in convs) {
    chs = [convs[convid].chSource, convs[convid].chDest];
    for (i = 0; i < chs.length; i++) {
      ch = chs[i];
      // only the channels of the extension, e.g. "PJSIP/205-0000002a"
      if (ch && typeof ch.channel === 'string' &&
        ch.channel.substring(0, ch.channel.lastIndexOf('-')).split('/')[1] === exten) {

        if (ch.channelStatus === 'up') {
          return false;
        }
        found = true;
      }
    }
  }
  return found;
}

/**
 * Executes the command associated with the streaming source to open
 * the associated device, e.g. a door.
 *
 * @method open
 * @param {string}   streamId The streaming source identifier
 * @param {string}   callerid The caller identifier
 * @param {string}   fromExten The extension of the user
 * @param {function} cb       The callback function
 */
function open(streamId, callerid, fromExten, cb) {
  openGate(streamId, undefined, callerid, fromExten, undefined, cb);
}

/**
 * Opens a gate of the streaming source. Without the gate identifier the
 * first gate is opened. Sources without gates in the configuration use the
 * "open" code (older FreePBX). A "dtmf" gate sends its code as DTMF tones to
 * the extension of the source, an "url" gate is opened by an HTTP request
 * done by the server. The DTMF code is not sent while the extension is in a
 * call not answered yet: the tones would get lost (error "call_not_answered").
 *
 * The callback error has the properties "status" (HTTP status code) and
 * "code" when the cause is known.
 *
 * @method openGate
 * @param {string}   streamId  The streaming source identifier
 * @param {string}   gateId    The gate identifier (optional)
 * @param {string}   callerid  The caller identifier
 * @param {string}   fromExten The extension of the user
 * @param {string}   username  The user that opens the gate (only for the log)
 * @param {function} cb        The callback function
 */
function openGate(streamId, gateId, callerid, fromExten, username, cb) {
  try {
    // check parameters
    if (typeof streamId !== 'string' || typeof callerid !== 'string' || typeof cb !== 'function' ||
      (gateId !== undefined && gateId !== null && typeof gateId !== 'string')) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var who = typeof username === 'string' ? 'user "' + username + '"' : 'caller ' + callerid;

    // check if the streaming source exists
    if (typeof streamings[streamId] !== 'object') {
      logger.log.warn(IDLOG, 'opening the non existent streaming source "' + streamId + '"');
      cb(streamingError(404, 'source_not_found', 'streaming source "' + streamId + '" does not exist'));
      return;
    }
    var gates = streamings[streamId].getGates();
    var gate = null;
    var i;

    if (gates === null || gates.length === 0) {
      if (gateId !== undefined && gateId !== null && gateId !== '') {
        cb(streamingError(404, 'gate_not_found', 'gate "' + gateId + '" of streaming source "' + streamId + '" does not exist'));
        return;
      }
      if (gates !== null && (typeof streamings[streamId].getOpenCommand() !== 'string' || streamings[streamId].getOpenCommand() === '')) {
        cb(streamingError(400, 'no_gates', 'streaming source "' + streamId + '" has no gates'));
        return;
      }
      if (isExtenCallNotAnswered(streamings[streamId].getExtension())) {
        logger.log.warn(IDLOG, who + ' cannot open streaming source "' + streamId + '" with its open code: the call of extension ' +
          streamings[streamId].getExtension() + ' is not answered');
        cb(callNotAnsweredError(streamings[streamId].getExtension()));
        return;
      }
      logger.log.warn(IDLOG, who + ' opens streaming source "' + streamId + '" with its open code');
      openLegacy(streamId, callerid, fromExten, cb);
      return;
    }

    if (gateId === undefined || gateId === null || gateId === '') {
      gate = gates[0];
    } else {
      for (i = 0; i < gates.length; i++) {
        if (gates[i].id === gateId) {
          gate = gates[i];
          break;
        }
      }
    }
    if (gate === null) {
      cb(streamingError(404, 'gate_not_found', 'gate "' + gateId + '" of streaming source "' + streamId + '" does not exist'));
      return;
    }
    var gateStr = 'gate "' + gate.id + '" (' + gate.name + ', ' + gate.type + ') of streaming source "' + streamId + '"';

    if (gate.type === 'dtmf') {
      var exten = streamings[streamId].getExtension();
      if (typeof exten !== 'string' || exten === '') {
        logger.log.warn(IDLOG, who + ' cannot open ' + gateStr + ': the source has no extension');
        cb(streamingError(400, 'no_extension', 'streaming source "' + streamId + '" has no extension to send the DTMF code to'));
        return;
      }
      if (gate.code === '') {
        logger.log.warn(IDLOG, who + ' cannot open ' + gateStr + ': the gate has no code');
        cb(streamingError(400, 'no_code', 'gate "' + gate.id + '" of streaming source "' + streamId + '" has no code'));
        return;
      }
      if (isExtenCallNotAnswered(exten)) {
        logger.log.warn(IDLOG, who + ' cannot open ' + gateStr + ': the call of extension ' + exten + ' is not answered');
        cb(callNotAnsweredError(exten));
        return;
      }
      compAstProxy.sendDTMFSequence(exten, gate.code, callerid, fromExten, function(err) {
        if (err) {
          logger.log.error(IDLOG, who + ' failed to open ' + gateStr + ' sending DTMF to extension ' + exten + ': ' + err);
          cb(streamingError(502, 'dtmf_failed', 'sending the DTMF code to extension ' + exten + ' failed'));
        } else {
          logger.log.warn(IDLOG, who + ' opened ' + gateStr + ' sending DTMF to extension ' + exten);
          cb(null);
        }
      });
      return;
    }

    // "url" gate
    if (gate.url === '') {
      cb(streamingError(400, 'no_url', 'gate "' + gate.id + '" of streaming source "' + streamId + '" has no URL'));
      return;
    }
    var memoKey = streamId + '/' + gate.id;
    if (!gateAuthMemos[memoKey]) {
      gateAuthMemos[memoKey] = {};
    }
    deviceHttp.deviceRequest({
      uri: gate.url,
      method: gate.method,
      timeout: GATE_URL_TIMEOUT,
      followRedirect: false,
      maxBytes: GATE_MAX_BYTES,
      // only this source: devices with a self-signed certificate, whose
      // certificate is pinned when the source is saved
      tlsSkipVerify: streamings[streamId].getTlsSkipVerify(),
      tlsFingerprint: gate.tlsFingerprint
    }, gate.username !== '' ? { username: gate.username, password: gate.password } : null,
    gateAuthMemos[memoKey], function(err, res) {
      try {
        if (err) {
          logger.log.error(IDLOG, who + ' failed to open ' + gateStr + ': ' + deviceHttp.describeError(err));
          if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
            cb(streamingError(504, 'gate_timeout', 'the gate device did not answer in time'));
          } else if (err.code === deviceHttp.ERR_FINGERPRINT_MISMATCH) {
            cb(streamingError(502, 'gate_certificate_changed',
              'the TLS certificate of the gate device changed: the administrator must save the video source again'));
          } else if (err.code === deviceHttp.ERR_ADDRESS_NOT_ALLOWED) {
            cb(streamingError(502, 'gate_address_not_allowed', 'the address of the gate device is not allowed'));
          } else if (err.code === deviceHttp.ERR_RESPONSE_TOO_LARGE) {
            cb(streamingError(502, 'gate_failed', 'the response of the gate device is too large'));
          } else if (deviceHttp.isTlsCertError(err)) {
            // same code as any unreachable device: only the message is specific
            cb(streamingError(502, 'gate_unreachable', 'the TLS certificate of the gate device is not valid'));
          } else {
            cb(streamingError(502, 'gate_unreachable', 'the gate device is not reachable'));
          }
          return;
        }
        if (deviceHttp.isSuccess(res.statusCode)) {
          logger.log.warn(IDLOG, who + ' opened ' + gateStr + ' (device answered ' + res.statusCode + ')');
          cb(null);
        } else {
          logger.log.error(IDLOG, who + ' failed to open ' + gateStr + ': device answered ' + res.statusCode);
          var e = streamingError(502, 'gate_failed', 'the gate device answered with HTTP status ' + res.statusCode);
          e.deviceStatus = res.statusCode;
          cb(e);
        }
      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
        cb(err1);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Sets the function used to check if a streaming source has subscribers.
 * The sources without subscribers are not sampled.
 *
 * @method setSubscribersChecker
 * @param {function} fn The function called with the streaming source identifier
 */
function setSubscribersChecker(fn) {
  if (typeof fn !== 'function') {
    throw new Error('wrong subscribers checker function');
  }
  hasSubscribers = fn;
}

/**
 * Subscribe to a streaming source.
 *
 * @method subscribeSource
 * @param {string}   username The username to subscribe with
 * @param {string}   streamId The streaming source identifier
 * @param {function} cb The callback function
 */
function subscribeSource(username, streamId, cb) {
  try {
    logger.log.info(IDLOG, 'emit event "' + EVT_STREAMING_SOURCE_SUBSCRIBED + '"');
    emitter.emit(EVT_STREAMING_SOURCE_SUBSCRIBED, {
      streaming: {
        username: username,
        streamId: streamId
      }
    });

    cb(null);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Unsubscribe from a streaming source.
 *
 * @method unsubscribeSource
 * @param {string}   username The username to subscribe with
 * @param {string}   streamId The streaming source identifier
 * @param {function} cb The callback function
 */
function unsubscribeSource(username, streamId, cb) {
  try {
    logger.log.info(IDLOG, 'emit event "' + EVT_STREAMING_SOURCE_UNSUBSCRIBED + '"');
    emitter.emit(EVT_STREAMING_SOURCE_UNSUBSCRIBED, {
      streaming: {
        username: username,
        streamId: streamId
      }
    });

    cb(null);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Subscribe a callback function to a custom event fired by this object.
 * It's the same of nodejs _events.EventEmitter.on_ method.
 *
 * @method on
 * @param {string} type The name of the event
 * @param {function} cb The callback to execute in response to the event
 * @return {object} A subscription handle capable of detaching that subscription.
 */
function on(type, cb) {
  try {
    return emitter.on(type, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Emit an event. It's the same of nodejs _events.EventEmitter.emit_ method.
 *
 * @method emit
 * @param {string} ev The name of the event
 * @param {object} data The object to be emitted
 */
function emit(ev, data) {
  try {
    emitter.emit(ev, data);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reset
 * @private
 */
function reset() {
  try {
    clearInterval(intervalGetSourceSample);
    intervalGetSourceSample = null;

    var k;
    for (k in streamings) {
      delete streamings[k];
    }
    streamings = {};
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reload
 * @private
 */
function reload() {
  try {
    reset();
    config(CONFIG_FILEPATH);
    start();
    // sources can have been removed or changed: check the gateway sessions
    scheduleGatewayCheck();
    logger.log.info(IDLOG, 'emit event "' + EVT_RELOADED + '"');
    emitter.emit(EVT_RELOADED);
    logger.log.warn(IDLOG, 'reloaded');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Check if the endpoint extension is a streaming source.
 *
 * @method isExtenStreamingSource
 * @param {string} extenId The extension endpoint identifier
 * @return {boolean} True if the extension endpoint is a steraming source.
 */
function isExtenStreamingSource(extenId) {
  try {
    if (typeof extenId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var stream;
    for (stream in streamings) {
      if (streamings[stream].getExtension() === extenId) {
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Returns the streaming source in JSON format or an empty object on error.
 *
 * @method getSourceJSONByExten
 * @param {string} extenId The extension endpoint identifier
 * @return {object} The streaming source in JSON format.
 */
function getSourceJSONByExten(extenId) {
  try {
    if (typeof extenId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var stream;
    for (stream in streamings) {
      if (streamings[stream].getExtension() === extenId) {
        return streamings[stream].toJSON();
      }
    }
    return {};
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Return the streaming image. A device whose TLS certificate is not the
 * pinned one gives the error 502 "source_certificate_changed".
 *
 * @method getVideoSample
 * @param {string} id The streaming source identifier
 * @param {function} cb The callback function
 */
function getVideoSample(id, cb) {
  try {
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (streamings[id] && streamings[id].getType() !== 'image') {
      var msg = 'streaming source "' + id + '" is not an image source';
      cb(streamingError(400, 'not_image_source', msg));
    } else if (streamings[id]) {
      streamings[id].getSample(function(err, id, img) {
        try {
          if (err) {
            logger.log.error(IDLOG, 'getting video sample for source "' + id + '": ' + deviceHttp.describeError(err));
          }
          if (err && err.code === deviceHttp.ERR_FINGERPRINT_MISMATCH) {
            cb(streamingError(502, 'source_certificate_changed',
              'the TLS certificate of the video source device changed: the administrator must save the video source again'));
            return;
          }
          cb(err, img);
        } catch (err1) {
          logger.log.error(IDLOG, err1.stack);
          cb(err1);
        }
      });
    } else {
      var str = 'getting source video sample: stream "' + id + '" not found';
      logger.log.warn(IDLOG, str);
      cb(str);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Reads the address of the video gateway API and the password of its user
 * from the configuration file (keys "mediamtx.api_port" and
 * "mediamtx.api_password" of services.json). Without them the gateway
 * sessions are not listed nor revoked, and the session limits count only
 * the sessions authorized since the start.
 *
 * @method configGateway
 * @param {string} path The path of the configuration file
 */
function configGateway(path) {
  try {
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameters: ' + JSON.stringify(arguments));
    }
    gatewayApiUrl = null;
    gatewayApiPassword = null;
    if (!fs.existsSync(path)) {
      logger.log.warn(IDLOG, path + ' doesn\'t exist: video gateway sessions will not be revoked');
      return;
    }
    var json = JSON.parse(fs.readFileSync(path, 'utf8'));
    var port = json && json.mediamtx ? String(json.mediamtx.api_port || '') : '';
    var password = json && json.mediamtx && typeof json.mediamtx.api_password === 'string' ? json.mediamtx.api_password : '';
    if (!/^\d{1,5}$/.test(port) || parseInt(port, 10) < 1 || parseInt(port, 10) > 65535) {
      logger.log.warn(IDLOG, 'video gateway API port not configured: video gateway sessions will not be revoked');
      return;
    }
    if (password === '') {
      // the gateway refuses the API without credentials: fail closed
      logger.log.warn(IDLOG, 'video gateway API password not configured: video gateway sessions will not be revoked');
      return;
    }
    gatewayApiUrl = 'http://127.0.0.1:' + parseInt(port, 10);
    gatewayApiPassword = password;
    logger.log.info(IDLOG, 'video gateway API at ' + gatewayApiUrl);
  } catch (err) {
    gatewayApiUrl = null;
    gatewayApiPassword = null;
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Starts the periodic check of the tokens and of the video gateway sessions.
 *
 * @method startGatewayCheck
 */
function startGatewayCheck() {
  try {
    if (intervalGatewayCheck) {
      return;
    }
    intervalGatewayCheck = setInterval(checkGatewaySessions, GATEWAY_CHECK_INTERVAL);
    // sessions authorized before a restart are unknown: check them soon
    scheduleGatewayCheck();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Schedules a check of the video gateway sessions. Used after the reload of
 * the component and of the authorizations: the delay lets all the
 * components complete their reload.
 *
 * @method scheduleGatewayCheck
 * @private
 */
function scheduleGatewayCheck() {
  try {
    clearTimeout(timeoutGatewayCheck);
    timeoutGatewayCheck = setTimeout(checkGatewaySessions, 2000);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns true if the user can still watch the RTSP source.
 *
 * @method canWatch
 * @param {string} username The username
 * @param {string} sourceId The streaming source identifier
 * @return {boolean} True if the source exists, it is an RTSP source and the user has its permission.
 * @private
 */
function canWatch(username, sourceId) {
  try {
    return (
      typeof streamings[sourceId] === 'object' &&
      streamings[sourceId].getType() === 'rtsp' &&
      compAuthorization.authorizeStreamingSourceUser(username, sourceId) === true
    );
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Removes the expired tokens and the ones that can no longer be used
 * (source removed or permission lost).
 *
 * @method cleanTokens
 * @private
 */
function cleanTokens() {
  var now = Date.now();
  var t;
  for (t in streamTokens) {
    if (streamTokens[t].expires <= now || !canWatch(streamTokens[t].username, streamTokens[t].sourceId)) {
      delete streamTokens[t];
    }
  }
}

/**
 * Returns the number of video gateway sessions of the user, on the given
 * source and in total, without the session "excludeId".
 *
 * @method countUserSessions
 * @param {string} username The username
 * @param {string} sourceId The streaming source identifier
 * @param {string} excludeId A session identifier not to count (optional)
 * @return {object} { source: number, total: number }
 * @private
 */
function countUserSessions(username, sourceId, excludeId) {
  var count = { source: 0, total: 0 };
  var id;
  for (id in gatewaySessions) {
    if (id !== excludeId && gatewaySessions[id].username === username) {
      count.total += 1;
      if (gatewaySessions[id].sourceId === sourceId) {
        count.source += 1;
      }
    }
  }
  return count;
}

/**
 * Returns the reason why the user cannot open one more video gateway
 * session on the source, or null if the user can.
 *
 * @method sessionLimitReason
 * @param {string} username The username
 * @param {string} sourceId The streaming source identifier
 * @param {string} excludeId A session identifier not to count (optional)
 * @return {string} The reason or null.
 * @private
 */
function sessionLimitReason(username, sourceId, excludeId) {
  var count = countUserSessions(username, sourceId, excludeId);
  if (count.source >= MAX_SESSIONS_PER_SOURCE) {
    return 'too many sessions on this source (' + count.source + ', max ' + MAX_SESSIONS_PER_SOURCE + ')';
  }
  if (count.total >= MAX_SESSIONS_PER_USER) {
    return 'too many sessions of the user (' + count.total + ', max ' + MAX_SESSIONS_PER_USER + ')';
  }
  return null;
}

/**
 * Updates the session records from the list of the video gateway: the
 * sessions closed by the gateway are forgotten, except the ones just
 * authorized (the gateway can list them a bit later). The callback gets the
 * listed sessions keyed by identifier, or null if the gateway API is not
 * available.
 *
 * @method refreshGatewaySessions
 * @param {function} cb The callback function (listed)
 * @private
 */
function refreshGatewaySessions(cb) {
  if (!gatewayApiUrl) {
    cb(null);
    return;
  }
  gatewayApi('GET', '/v3/webrtcsessions/list?itemsPerPage=1000', function(err, status, body) {
    try {
      if (err || status !== 200 || !body || !Array.isArray(body.items)) {
        if (!gatewayApiFailing) {
          gatewayApiFailing = true;
          logger.log.warn(IDLOG, 'listing video gateway sessions: ' + (err ? err.message : 'gateway answered ' + status));
        }
        cb(null);
        return;
      }
      if (gatewayApiFailing) {
        gatewayApiFailing = false;
        logger.log.info(IDLOG, 'video gateway API is reachable again');
      }
      var listed = {};
      var now = Date.now();
      var i, id;
      for (i = 0; i < body.items.length; i++) {
        if (body.items[i] && typeof body.items[i].id === 'string') {
          listed[body.items[i].id] = body.items[i];
        }
      }
      for (id in gatewaySessions) {
        if (!listed[id] && now - gatewaySessions[id].created >= SESSION_RECORD_GRACE) {
          delete gatewaySessions[id];
        }
      }
      cb(listed);
    } catch (err1) {
      logger.log.error(IDLOG, err1.stack);
      cb(null);
    }
  });
}

/**
 * Returns a new token that allows the user to open one session on the RTSP
 * source through the video gateway, within STREAM_TOKEN_TTL seconds. The
 * caller must have checked the permission of the user.
 *
 * The user gets the error 429 "too_many_requests" beyond TOKEN_RATE_LIMIT
 * tokens per minute and 429 "too_many_sessions" when the user already has
 * MAX_SESSIONS_PER_SOURCE sessions on the source or MAX_SESSIONS_PER_USER
 * sessions in total.
 *
 * @method createStreamToken
 * @param {string}   username The username
 * @param {string}   sourceId The streaming source identifier
 * @param {function} cb The callback function (err, { token, expires_in, whep })
 */
function createStreamToken(username, sourceId, cb) {
  try {
    if (typeof username !== 'string' || typeof sourceId !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (typeof streamings[sourceId] !== 'object') {
      cb(streamingError(404, 'source_not_found', 'streaming source "' + sourceId + '" does not exist'));
      return;
    }
    if (streamings[sourceId].getType() !== 'rtsp') {
      cb(streamingError(400, 'not_rtsp_source', 'streaming source "' + sourceId + '" is not an RTSP source'));
      return;
    }

    // rate limit, counted on the requests of the last window
    var now = Date.now();
    var u;
    for (u in tokenRequests) {
      tokenRequests[u] = tokenRequests[u].filter(function(ts) { return now - ts < TOKEN_RATE_WINDOW; });
      if (tokenRequests[u].length === 0) {
        delete tokenRequests[u];
      }
    }
    if ((tokenRequests[username] || []).length >= TOKEN_RATE_LIMIT) {
      logger.log.warn(IDLOG, 'stream token of source "' + sourceId + '" denied to user "' + username + '": more than ' +
        TOKEN_RATE_LIMIT + ' tokens in ' + (TOKEN_RATE_WINDOW / 1000) + ' s');
      cb(streamingError(429, 'too_many_requests', 'too many stream token requests: retry later'));
      return;
    }
    tokenRequests[username] = (tokenRequests[username] || []).concat([now]);

    var issue = function() {
      try {
        var reason = sessionLimitReason(username, sourceId);
        if (reason !== null) {
          logger.log.warn(IDLOG, 'stream token of source "' + sourceId + '" denied to user "' + username + '": ' + reason);
          cb(streamingError(429, 'too_many_sessions', reason));
          return;
        }
        cleanTokens();
        // limit the number of unused tokens of the user
        var userTokens = Object.keys(streamTokens).filter(function(t) {
          return streamTokens[t].username === username && streamTokens[t].sessionId === null;
        }).sort(function(a, b) {
          return streamTokens[a].expires - streamTokens[b].expires;
        });
        while (userTokens.length >= MAX_TOKENS_PER_USER) {
          delete streamTokens[userTokens.shift()];
        }

        var token = crypto.randomBytes(32).toString('hex');
        streamTokens[token] = {
          username: username,
          sourceId: sourceId,
          expires: Date.now() + STREAM_TOKEN_TTL * 1000,
          sessionId: null
        };
        logger.log.info(IDLOG, 'new stream token for user "' + username + '" and source "' + sourceId + '"');
        cb(null, {
          token: token,
          expires_in: STREAM_TOKEN_TTL,
          whep: streamings[sourceId].getWhepUrl()
        });
      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
        cb(err1);
      }
    };
    if (sessionLimitReason(username, sourceId) !== null) {
      // the records can include sessions already closed: check the gateway
      refreshGatewaySessions(function() { issue(); });
    } else {
      issue();
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns true if the two strings are equal, in a time that does not depend
 * on their content.
 *
 * @method secretEquals
 * @param {string} a The first string
 * @param {string} b The second string
 * @return {boolean} True if they are equal.
 * @private
 */
function secretEquals(a, b) {
  var ha = crypto.createHash('sha256').update(String(a)).digest();
  var hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Decides if the video gateway can accept a request. It is called by the
 * authentication hook of the gateway with the JSON body sent by it:
 *
 *     { ip, user, password, token, action, path, protocol, id, query, userAgent }
 *
 * - "api" action (control API): allowed only to the user GATEWAY_API_USER
 *   with the password of services.json (used by this component)
 * - "read" action: only WebRTC readers of the gateway path of an existing
 *   RTSP source are allowed, when they present a valid token ("token" field,
 *   filled by the gateway from "Authorization: Bearer"; the query string is
 *   ignored) created for the same source by a user that still has its
 *   permission. A token is consumed by the first session it opens: any other
 *   session presenting it is denied. The user cannot have more than
 *   MAX_SESSIONS_PER_SOURCE sessions on a source and MAX_SESSIONS_PER_USER
 *   in total. The session of an allowed reader is recorded to revoke it later.
 * - anything else is denied
 *
 * The tokens and the passwords are never logged.
 *
 * @method authorizeGatewayReader
 * @param {object} req The request of the gateway
 * @return {object} The decision: { allow: boolean, reason: string, code: string, username, sourceId }
 */
function authorizeGatewayReader(req) {
  try {
    if (!req || typeof req !== 'object' || Array.isArray(req)) {
      return { allow: false, reason: 'bad request' };
    }
    if (req.action === 'api') {
      if (gatewayApiPassword === null) {
        return { allow: false, reason: 'gateway API credentials not configured' };
      }
      if (req.user !== GATEWAY_API_USER || typeof req.password !== 'string' ||
        !secretEquals(req.password, gatewayApiPassword)) {

        return { allow: false, reason: 'wrong gateway API credentials' };
      }
      return { allow: true, reason: 'gateway API user' };
    }
    if (req.action !== 'read') {
      return { allow: false, reason: 'action not allowed' };
    }
    if (req.protocol !== 'webrtc') {
      return { allow: false, reason: 'protocol not allowed' };
    }
    if (typeof req.path !== 'string' || req.path === '') {
      return { allow: false, reason: 'unknown path' };
    }
    var sourceId = null;
    var s;
    for (s in streamings) {
      if (streamings[s].getType() === 'rtsp' && streamings[s].getGatewayPath() === req.path) {
        sourceId = s;
        break;
      }
    }
    if (sourceId === null) {
      return { allow: false, reason: 'unknown path' };
    }
    if (typeof req.id !== 'string' || req.id === '') {
      return { allow: false, reason: 'missing session id', sourceId: sourceId };
    }
    if (typeof req.token !== 'string' || req.token === '') {
      return { allow: false, reason: 'missing token', sourceId: sourceId };
    }
    var now = Date.now();
    var entry = null;
    if (Object.prototype.hasOwnProperty.call(streamTokens, req.token)) {
      entry = streamTokens[req.token];
      if (entry.expires <= now) {
        delete streamTokens[req.token];
        entry = null;
      }
    }
    if (entry === null) {
      return { allow: false, reason: 'invalid or expired token', sourceId: sourceId };
    }
    if (entry.sourceId !== sourceId) {
      return { allow: false, reason: 'token not valid for this source', sourceId: sourceId, username: entry.username };
    }
    if (entry.sessionId !== null && entry.sessionId !== req.id) {
      return { allow: false, reason: 'token already used', code: 'token_used', sourceId: sourceId, username: entry.username };
    }
    if (!canWatch(entry.username, sourceId)) {
      return { allow: false, reason: 'permission denied', sourceId: sourceId, username: entry.username };
    }
    if (gatewaySessions[req.id] && gatewaySessions[req.id].token !== req.token) {
      return { allow: false, reason: 'session authorized with another token', sourceId: sourceId, username: entry.username };
    }
    if (!gatewaySessions[req.id]) {
      var limit = sessionLimitReason(entry.username, sourceId, req.id);
      if (limit !== null) {
        return { allow: false, reason: limit, code: 'too_many_sessions', sourceId: sourceId, username: entry.username };
      }
      gatewaySessions[req.id] = {
        username: entry.username,
        sourceId: sourceId,
        created: now,
        token: req.token
      };
    }
    // the same session can be authorized again, no other one
    entry.sessionId = req.id;
    return { allow: true, reason: 'valid token', sourceId: sourceId, username: entry.username };
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return { allow: false, reason: 'internal error' };
  }
}

/**
 * Like _authorizeGatewayReader_, but when a reader is denied because of the
 * session limits the session records are updated from the gateway (sessions
 * closed meanwhile) and the request is evaluated again.
 *
 * @method authorizeGatewayRequest
 * @param {object}   req The request of the gateway
 * @param {function} cb The callback function (decision)
 */
function authorizeGatewayRequest(req, cb) {
  var decision = authorizeGatewayReader(req);
  if (decision.allow || decision.code !== 'too_many_sessions' || !gatewayApiUrl) {
    cb(decision);
    return;
  }
  refreshGatewaySessions(function() {
    cb(authorizeGatewayReader(req));
  });
}

/**
 * Executes a request to the video gateway API, authenticated as
 * GATEWAY_API_USER.
 *
 * @method gatewayApi
 * @param {string}   method The HTTP method
 * @param {string}   path The API path, e.g. "/v3/webrtcsessions/list"
 * @param {function} cb The callback function (err, statusCode, body)
 * @private
 */
function gatewayApi(method, path, cb) {
  if (!gatewayApiUrl || !gatewayApiPassword) {
    cb(new Error('video gateway API not configured'));
    return;
  }
  request({
    uri: gatewayApiUrl + path,
    method: method,
    json: true,
    timeout: GATEWAY_API_TIMEOUT,
    followRedirect: false,
    auth: { user: GATEWAY_API_USER, pass: gatewayApiPassword, sendImmediately: true }
  }, function(err, res, body) {
    if (err) {
      cb(err);
      return;
    }
    cb(null, res.statusCode, body);
  });
}

/**
 * Kicks a session from the video gateway.
 *
 * @method kickGatewaySession
 * @param {string}   id The gateway session identifier
 * @param {string}   reason The reason, for the log
 * @param {function} cb The callback function
 * @private
 */
function kickGatewaySession(id, reason, cb) {
  var s = gatewaySessions[id];
  var what = 'session ' + id + (s ? ' of user "' + s.username + '" on source "' + s.sourceId + '"' : '');
  gatewayApi('POST', '/v3/webrtcsessions/kick/' + encodeURIComponent(id), function(err, status) {
    if (err) {
      logger.log.error(IDLOG, 'kicking video gateway ' + what + ': ' + err.message);
    } else if (status >= 200 && status < 300) {
      logger.log.warn(IDLOG, 'kicked video gateway ' + what + ': ' + reason);
      delete gatewaySessions[id];
    } else if (status === 404) {
      delete gatewaySessions[id];
    } else {
      logger.log.error(IDLOG, 'kicking video gateway ' + what + ': gateway answered ' + status);
    }
    if (typeof cb === 'function') {
      cb();
    }
  });
}

/**
 * Checks the tokens and the video gateway sessions: removes the tokens that
 * can no longer be used, forgets the sessions closed by the gateway and kicks
 * the sessions whose user lost the permission, whose source no longer
 * exists, or that are unknown (authorized before a restart of the server).
 *
 * @method checkGatewaySessions
 * @param {function} cb The callback function (optional)
 */
function checkGatewaySessions(cb) {
  var done = function() {
    if (typeof cb === 'function') {
      cb();
    }
  };
  try {
    cleanTokens();
    if (!gatewayApiUrl) {
      // without the gateway API the sessions cannot be listed nor kicked:
      // forget the old records, so that they do not count in the limits
      var id0;
      for (id0 in gatewaySessions) {
        if (Date.now() - gatewaySessions[id0].created >= GATEWAY_CHECK_INTERVAL) {
          delete gatewaySessions[id0];
        }
      }
      done();
      return;
    }
    refreshGatewaySessions(function(listed) {
      try {
        if (listed === null) {
          done();
          return;
        }
        var toKick = [];
        var id, s, created;
        for (id in listed) {
          s = gatewaySessions[id];
          if (!s) {
            // a session being authorized can be listed before its record:
            // only the old enough ones are unknown
            created = Date.parse(listed[id].created);
            if (isNaN(created) || Date.now() - created >= UNKNOWN_SESSION_GRACE) {
              toKick.push({ id: id, reason: 'unknown session' });
            }
          } else if (typeof streamings[s.sourceId] !== 'object' || streamings[s.sourceId].getType() !== 'rtsp') {
            toKick.push({ id: id, reason: 'source removed' });
          } else if (!canWatch(s.username, s.sourceId)) {
            toKick.push({ id: id, reason: 'permission revoked' });
          }
        }
        var pending = toKick.length;
        if (pending === 0) {
          done();
          return;
        }
        toKick.forEach(function(k) {
          kickGatewaySession(k.id, k.reason, function() {
            pending -= 1;
            if (pending === 0) {
              done();
            }
          });
        });
      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
        done();
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    done();
  }
}

// public interface
exports.EVT_RELOADED = EVT_RELOADED;
exports.on = on;
exports.reload = reload;
exports.emit = emit;
exports.start = start;
exports.open = open;
exports.openGate = openGate;
exports.configGateway = configGateway;
exports.startGatewayCheck = startGatewayCheck;
exports.createStreamToken = createStreamToken;
exports.checkGatewaySessions = checkGatewaySessions;
exports.authorizeGatewayReader = authorizeGatewayReader;
exports.authorizeGatewayRequest = authorizeGatewayRequest;
exports.STREAM_TOKEN_TTL = STREAM_TOKEN_TTL;
exports.config = config;
exports.setLogger = setLogger;
exports.getVideoSample = getVideoSample;
exports.setCompAstProxy = setCompAstProxy;
exports.setCompAuthorization = setCompAuthorization;
exports.getAllStreamingSources = getAllStreamingSources;
exports.subscribeSource = subscribeSource;
exports.unsubscribeSource = unsubscribeSource;
exports.setSubscribersChecker = setSubscribersChecker;
exports.getSourceJSONByExten = getSourceJSONByExten;
exports.isExtenStreamingSource = isExtenStreamingSource;
exports.EVT_STREAMING_SOURCE_CHANGED = EVT_STREAMING_SOURCE_CHANGED;
exports.EVT_STREAMING_SOURCE_SUBSCRIBED = EVT_STREAMING_SOURCE_SUBSCRIBED;
exports.EVT_STREAMING_SOURCE_UNSUBSCRIBED = EVT_STREAMING_SOURCE_UNSUBSCRIBED;
