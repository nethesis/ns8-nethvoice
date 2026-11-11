var deviceHttp = require('./device_http');
var deviceRequest = deviceHttp.deviceRequest;

/**
 * The maximum size in bytes of a snapshot of an image source.
 *
 * @property MAX_SNAPSHOT_BYTES
 * @type number
 * @default 5242880
 */
var MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

/**
 * The prefix of the video gateway path of the RTSP sources.
 *
 * @property GATEWAY_PATH_PREFIX
 * @type string
 * @default "streaming-gw/"
 */
var GATEWAY_PATH_PREFIX = 'streaming-gw/';

/**
 * Returns the gates of the streaming source read from the configuration,
 * skipping the malformed ones, or null if the configuration has no gates
 * (configuration written by an older FreePBX).
 *
 * @method parseGates
 * @param {array} gates The gates of the configuration file
 * @return {array} The gates or null.
 * @private
 */
function parseGates(gates) {
  if (!Array.isArray(gates)) {
    return null;
  }
  var result = [];
  var i, g, method;
  for (i = 0; i < gates.length; i++) {
    g = gates[i];
    if (!g || typeof g !== 'object' || g.id === undefined || g.id === null ||
      (g.type !== 'dtmf' && g.type !== 'url')) {
      continue;
    }
    if (g.type === 'dtmf') {
      result.push({
        id: String(g.id),
        name: typeof g.name === 'string' ? g.name : '',
        type: 'dtmf',
        code: typeof g.code === 'string' ? g.code : (g.code === undefined || g.code === null ? '' : String(g.code))
      });
    } else {
      method = typeof g.method === 'string' ? g.method.toUpperCase() : 'GET';
      result.push({
        id: String(g.id),
        name: typeof g.name === 'string' ? g.name : '',
        type: 'url',
        url: typeof g.url === 'string' ? g.url : '',
        method: method === 'POST' ? 'POST' : 'GET',
        username: typeof g.username === 'string' ? g.username : '',
        password: typeof g.password === 'string' ? g.password : '',
        // SHA-256 of the device certificate pinned when the source was saved
        // (only with tls_skip_verify, https:// gates)
        tlsFingerprint: deviceHttp.normalizeFingerprint(g.tls_fingerprint)
      });
    }
  }
  return result;
}

/**
 * Abstraction of a streaming source.
 *
 * **It can throw exceptions.**
 *
 * @class Streaming
 * @param {object} data The streaming information
 *   @param {object} data.id         The streaming identifier
 *   @param {object} data.url        The HTTP url of the streaming
 *   @param {object} data.exten      The streaming extension
 *   @param {object} data.descr      The streaming description
 *   @param {object} data.open       The command to open the streaming device
 *   @param {object} data.user       The streaming username
 *   @param {object} data.secret     The streaming password
 *   @param {object} data.frame-rate The frame rate of the streaming images
 *   @param {object} data.type       The source type: "image" (default) or "rtsp"
 *   @param {object} data.gateway_path The video gateway path of an "rtsp" source
 *   @param {object} data.image_auth The credentials ({ username, password }) of the snapshot URL
 *   @param {object} data.gates      The gates that can be opened ("dtmf" or "url")
 *   @param {boolean} data.tls_skip_verify Do not verify the TLS certificate of the
 *                                   snapshot URL and of the URL gates (self-signed devices)
 *   @param {string} data.tls_fingerprint With tls_skip_verify, the SHA-256 fingerprint of the
 *                                   certificate of the https:// snapshot URL (pinned when saved)
 * @constructor
 * @return {object} The streaming object.
 */
exports.Streaming = function(data) {
  /**
   * The streaming identifier.
   *
   * @property id
   * @type {string}
   * @required
   * @private
   */
  var id = data.id;

  /**
   * The streaming description.
   *
   * @property description
   * @type {string}
   * @required
   * @private
   */
  var description = data.descr;

  /**
   * The HTTP url of the video source.
   *
   * @property url
   * @type {string}
   * @required
   * @private
   */
  var url = data.url;

  /**
   * The streaming extension identifier.
   *
   * @property extension
   * @type {string}
   * @required
   * @private
   */
  var extension = data.exten;

  /**
   * The command to open the streaming device.
   *
   * @property cmdOpen
   * @type {string}
   * @required
   * @private
   */
  var cmdOpen = data.open;

  /**
   * The frame rate of the video streaming.
   *
   * @property frameRate
   * @type {string}
   * @required
   * @private
   */
  var frameRate = data['frame-rate'];

  /**
   * The username for authenticate streaming source.
   *
   * @property user
   * @type {string}
   * @required
   * @private
   */
  var user = data.user;

  /**
   * The password for authenticate streaming source.
   *
   * @property password
   * @type {string}
   * @required
   * @private
   */
  var password = data.secret;

  /**
   * The source type: "image" (snapshot URL sampled by the server) or "rtsp"
   * (video served by the video gateway).
   *
   * @property type
   * @type {string}
   * @private
   */
  var type = data.type === 'rtsp' ? 'rtsp' : 'image';

  /**
   * The video gateway path of an "rtsp" source.
   *
   * @property gatewayPath
   * @type {string}
   * @private
   */
  var gatewayPath = null;
  if (type === 'rtsp') {
    gatewayPath = (typeof data.gateway_path === 'string' && data.gateway_path !== '') ?
      data.gateway_path : GATEWAY_PATH_PREFIX + id;
  }

  /**
   * The credentials of the snapshot URL of an "image" source. Older
   * configurations have them in "user" and "secret".
   *
   * @property imageAuth
   * @type {object}
   * @private
   */
  var imageAuth = null;
  if (type === 'image') {
    if (data.image_auth && typeof data.image_auth === 'object' &&
      typeof data.image_auth.username === 'string' && data.image_auth.username !== '') {
      imageAuth = {
        username: data.image_auth.username,
        password: typeof data.image_auth.password === 'string' ? data.image_auth.password : ''
      };
    } else if (data.image_auth === undefined && typeof user === 'string' && user !== '') {
      imageAuth = {
        username: user,
        password: typeof password === 'string' ? password : ''
      };
    }
  }

  /**
   * The gates of the source, null if the configuration has none (written
   * by an older FreePBX: the "open" command is used instead).
   *
   * @property gates
   * @type {array}
   * @private
   */
  var gates = parseGates(data.gates);

  /**
   * True if the TLS certificate of the device is not verified, for the
   * snapshot URL and the URL gates of this source only (devices with a
   * self-signed certificate). Anything but the boolean true means false.
   *
   * @property tlsSkipVerify
   * @type {boolean}
   * @private
   */
  var tlsSkipVerify = data.tls_skip_verify === true;

  /**
   * The SHA-256 fingerprint of the certificate of the https:// snapshot URL,
   * pinned when the source was saved. Used only with _tlsSkipVerify_: without
   * it (sources saved by an older version) the certificate is not checked.
   *
   * @property tlsFingerprint
   * @type {string}
   * @private
   */
  var tlsFingerprint = deviceHttp.normalizeFingerprint(data.tls_fingerprint);

  /**
   * Authentication state of the snapshot URL shared by the samples.
   *
   * @property sampleAuthMemo
   * @type {object}
   * @private
   */
  var sampleAuthMemo = {};

  /**
   * Returns the streaming source.
   *
   * @method getUrl
   * @return {string} The streaming source.
   */
  function getUrl() {
    return url;
  }

  /**
   * Returns the streaming source frame rate.
   *
   * @method getFramerate
   * @return {string} The streaming source frame-rate.
   */
  function getFramerate() {
    return frameRate;
  }

  /**
   * Returns the command to open the streaming device.
   *
   * @method getOpenCommand
   * @return {string} The command to open the streaming device
   */
  function getOpenCommand() {
    return cmdOpen;
  }

  /**
   * Returns the extension associated with the streaming source.
   *
   * @method getExtension
   * @return {string} The extension of the streaming source.
   */
  function getExtension() {
    return extension;
  }

  /**
   * Returns the streaming source identifier.
   *
   * @method getId
   * @return {string} The streaming source identifier.
   */
  function getId() {
    return id;
  }

  /**
   * Returns the source type: "image" or "rtsp".
   *
   * @method getType
   * @return {string} The source type.
   */
  function getType() {
    return type;
  }

  /**
   * Returns the video gateway path of an "rtsp" source, null otherwise.
   *
   * @method getGatewayPath
   * @return {string} The video gateway path.
   */
  function getGatewayPath() {
    return gatewayPath;
  }

  /**
   * Returns the relative WHEP URL of an "rtsp" source, null otherwise.
   *
   * @method getWhepUrl
   * @return {string} The relative WHEP URL.
   */
  function getWhepUrl() {
    return gatewayPath ? '/' + gatewayPath + '/whep' : null;
  }

  /**
   * Returns the gates with all their data, credentials included: **never
   * send them to the clients**. Null if the configuration has no gates.
   *
   * @method getGates
   * @return {array} The gates.
   */
  function getGates() {
    return gates;
  }

  /**
   * Returns true if the TLS certificate of the device must not be verified
   * (snapshot URL and URL gates of this source).
   *
   * @method getTlsSkipVerify
   * @return {boolean} True to skip the certificate verification.
   */
  function getTlsSkipVerify() {
    return tlsSkipVerify;
  }

  /**
   * Returns the pinned SHA-256 fingerprint of the certificate of the snapshot
   * URL, null if none.
   *
   * @method getTlsFingerprint
   * @return {string} The fingerprint or null.
   */
  function getTlsFingerprint() {
    return tlsFingerprint;
  }

  /**
   * Return the readable string of the streaming source.
   *
   * @method toString
   * @return {string} The readable description of the streaming source.
   */
  function toString() {
    return 'streaming "' + id + '" from ' + url;
  }

  /**
   * Returns the JSON representation of the object sent to the clients. It
   * never contains the address of the device nor any credential: "url",
   * "user" and "password" are kept for compatibility and are always empty.
   *
   *     {
   *         id:          "vs_door",                           // the identifier
   *         url:         "",
   *         user:        "",
   *         cmdOpen:     "0*",                                // the DMTF code to open the streaming device
   *         password:    "",
   *         frameRate:   "1000",                              // the frame rate of the streaming images
   *         extension:   "301",                               // the streaming extension
   *         description: "The door",                          // the streaming description
   *         type:        "rtsp",                              // "image" or "rtsp"
   *         whep:        "/streaming-gw/vs_door/whep",        // relative WHEP URL ("rtsp" only, null otherwise)
   *         gates:       [{ id: "1", name: "Door", type: "dtmf" }] // the gates that can be opened
   *     }
   *
   * @method toJSON
   * @return {object} The JSON representation of the object.
   */
  function toJSON() {
    var publicGates = [];
    var i;
    for (i = 0; gates && i < gates.length; i++) {
      publicGates.push({
        id: gates[i].id,
        name: gates[i].name,
        type: gates[i].type
      });
    }
    return {
      id: id,
      url: '',
      user: '',
      cmdOpen: cmdOpen,
      password: '',
      frameRate: frameRate,
      extension: extension,
      description: description,
      type: type,
      whep: getWhepUrl(),
      gates: publicGates
    };
  }

  /**
   * Return the video sample in base64 format.
   *
   * @method getSample
   * @param {function} cb The callback function
   * @return {object} The sample from video source in base64 format.
   */
  function getSample(cb) {
    try {
      if (type !== 'image') {
        cb('not an image source', id);
        return;
      }
      if (url) {
        deviceRequest({
          uri: new URL(url).href,
          encoding: null,
          timeout: 2000,
          // credentials are never sent to another address
          followRedirect: false,
          maxBytes: MAX_SNAPSHOT_BYTES,
          tlsSkipVerify: tlsSkipVerify,
          tlsFingerprint: tlsFingerprint
        }, imageAuth, sampleAuthMemo, function(err, res, body) {
          if (!err && res.statusCode === 200) {
            var data = "data:" + res.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
            cb(err, id, data);
          } else {
            cb(err || ('HTTP status ' + res.statusCode), id);
          }
        });
      } else {
        cb('url not found', id);
      }
    } catch (error) {
      throw error;
    }
  }

  // public interface
  return {
    getUrl: getUrl,
    toJSON: toJSON,
    toString: toString,
    getId: getId,
    getType: getType,
    getGates: getGates,
    getTlsSkipVerify: getTlsSkipVerify,
    getTlsFingerprint: getTlsFingerprint,
    getWhepUrl: getWhepUrl,
    getExtension: getExtension,
    getGatewayPath: getGatewayPath,
    getFramerate: getFramerate,
    getOpenCommand: getOpenCommand,
    getSample: getSample
  };
};
