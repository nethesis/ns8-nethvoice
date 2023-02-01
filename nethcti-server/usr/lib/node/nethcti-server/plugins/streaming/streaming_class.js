var request = require("request");
var fs = require('fs');

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
 *   @param {object} data.sample     The streaming sample
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
   * Return the readable string of the streaming source.
   *
   * @method toString
   * @return {string} The readable description of the streaming source.
   */
  function toString() {
    return 'streaming "' + id + '" from ' + url;
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         id:          "door",                           // the identifier
   *         url:         "http://192.168.5.224/image.jpg", // the HTTP url of the streaming source
   *         user:        "root",                           // the username
   *         cmdOpen:     "0*",                             // the DMTF code to open the streaming device
   *         password:    "password",                       // the password
   *         frameRate:   "1000",                           // the frame rate of the streaming images
   *         extension:   "301",                            // the streaming extension
   *         description: "The door",                       // the streaming description
   *     }
   *
   * @method toJSON
   * @return {object} The JSON representation of the object.
   */
  function toJSON() {
    return {
      id: id,
      url: url,
      user: user,
      cmdOpen: cmdOpen,
      password: password,
      frameRate: frameRate,
      extension: extension,
      description: description
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
      if (url) {
        request({
          uri: new URL(url),
          encoding: null,
          timeout: 2000
        }, function(err, res, body) {
          if (!err && res.statusCode === 200) {
            var data = "data:" + res.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
            cb(err, id, data);
          } else {
            cb(err, id);
          }
        });
      } else {
        cb('url not found');
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
    getExtension: getExtension,
    getFramerate: getFramerate,
    getOpenCommand: getOpenCommand,
    getSample: getSample
  };
};
