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
var Streaming = require('./streaming_class').Streaming;
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
 * It is used when the streaming source has some problems. So it
 * serves to log the error only once.
 *
 * @property streamings
 * @type object
 * @private
 * @default {}
 */
let streamingErrors = {};

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
    }

    logger.log.info(IDLOG, 'configured streaming sources: ' + Object.keys(streamings));
    logger.log.info(IDLOG, 'streaming configuration by file ' + CONFIG_FILEPATH + ' ended');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
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
          if (loopStep % (streamings[i].getFramerate() / baseTime) === 0) {
            // emit the streaming source changed event
            streamings[i].getSample(function(err1, id, img) {
              try {
                if (err1) {
                  if (streamingErrors[id] === undefined) {
                    streamingErrors[id] = 'logged';
                    logger.log.warn(IDLOG, 'streaming "' + id + '" error: ' + err1.toString());
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
        results[i] = streamings[i];
      }
    }
    cb(null, results);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Executes the command associated with the streaming source to open
 * the associated device, e.g. a door.
 *
 * @method open
 * @param {string}   streamId The streaming source identifier
 * @param {string}   callerid The caller identifier
 * @param {function} cb       The callback function
 */
function open(streamId, callerid, fromExten, cb) {
  try {
    // check parameters
    if (typeof streamId !== 'string' || typeof callerid !== 'string' || typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check if the streaming source exists
    if (typeof streamings[streamId] !== 'object') {
      logger.log.warn(IDLOG, 'opening the non existent streaming source "' + streamId + '"');
      cb('error: streaming source "' + streamId + '" does not exist');
      return;
    }

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
        logger.log.error(IDLOG, 'sending DTMF sequence "' + opencmd + '" to extension ' + exten);
        cb(err);

      } else {
        logger.log.info(IDLOG, 'sending DTMF sequence "' + opencmd + '" to extension ' + exten + ' has been successful');
        cb(null);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
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
 * Return the streaming image.
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
    if (streamings[id]) {
      streamings[id].getSample(function(err, id, img) {
        try {
          if (err) {
            logger.log.error(IDLOG, 'getting video sample for source "' + id + '": ' + err)
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

// public interface
exports.EVT_RELOADED = EVT_RELOADED;
exports.on = on;
exports.reload = reload;
exports.emit = emit;
exports.start = start;
exports.open = open;
exports.config = config;
exports.setLogger = setLogger;
exports.getVideoSample = getVideoSample;
exports.setCompAstProxy = setCompAstProxy;
exports.setCompAuthorization = setCompAuthorization;
exports.getAllStreamingSources = getAllStreamingSources;
exports.subscribeSource = subscribeSource;
exports.unsubscribeSource = unsubscribeSource;
exports.getSourceJSONByExten = getSourceJSONByExten;
exports.isExtenStreamingSource = isExtenStreamingSource;
exports.EVT_STREAMING_SOURCE_CHANGED = EVT_STREAMING_SOURCE_CHANGED;
exports.EVT_STREAMING_SOURCE_SUBSCRIBED = EVT_STREAMING_SOURCE_SUBSCRIBED;
exports.EVT_STREAMING_SOURCE_UNSUBSCRIBED = EVT_STREAMING_SOURCE_UNSUBSCRIBED;
