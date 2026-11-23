/**
 * Abstraction of a voicemail endpoint.
 *
 * **It can throw exception.**
 *
 * @class EndpointVoicemail
 * @param {object} vmid The voicemail identifier
 * @constructor
 * @return {object} The EndpointVoicemail object.
 */
exports.EndpointVoicemail = function(vmid) {
  // check the parameter
  if (typeof vmid !== 'string') {
    throw new Error('wrong parameter');
  }

  /**
   * The voicemail identifier.
   *
   * @property id
   * @type {string}
   * @required
   * @private
   */
  var id = vmid;

  /**
   * The name of the voicemail owner.
   *
   * @property owner
   * @type string
   * @required
   * @private
   */
  var owner;

  /**
   * The context of the voicemail
   *
   * @property context
   * @type string
   * @required
   * @private
   */
  var context;

  /**
   * The email of the voicemail.
   *
   * @property email
   * @type {string}
   * @private
   */
  var email;

  /**
   * The maximum number of messages of the voicemail.
   *
   * @property maxMessageCount
   * @type string
   * @private
   */
  var maxMessageCount;

  /**
   * The maximum lenght of the voicemail messages.
   *
   * @property maxMessageLength
   * @type string
   * @private
   */
  var maxMessageLength;

  /**
   * Returns the voicemail identifier.
   *
   * @method getId
   * @return {string} The voicemail identifier.
   */
  function getId() {
    return id;
  }

  /**
   * Returns the owner of the voicemail.
   *
   * @method getOwner
   * @return {string} The owner of the voicemail.
   */
  function getOwner() {
    return owner;
  }

  /**
   * Return the readable string description of the voicemail.
   *
   * @method toString
   * @return {string} The readable description of the voicemail
   */
  function toString() {
    return 'Voicemail of "' + id + '"';
  }

  /**
   * Returns the JSON representation of the object.
   *
   * @method toJSON
   * @return {object} The JSON representation of the object.
   */
  function toJSON() {
    return {
      id: id,
      owner: owner,
      email: email,
      maxMessageCount: maxMessageCount,
      maxMessageLength: maxMessageLength
    };
  }

  // public interface
  return {
    getId: getId,
    toJSON: toJSON,
    getOwner: getOwner,
    toString: toString
  };
};
