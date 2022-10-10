/**
 * Abstraction of a meetme conference user.
 *
 * **It can throw exception.**
 *
 * @class MeetmeConfUser
 * @param {string} userId The user identifier in the conference
 * @param {string} extId The extension identifier
 * @param {string} ownerValue True if the user is the owner of the conference
 * @param {string} ch The asterisk channel of the extension
 * @return {object} The conference user object.
 * @constructor
 */
exports.MeetmeConfUser = function (userId, extId, ownerValue, ch) {
  // check the parameters
  if (typeof userId !== 'string' ||
    typeof ownerValue !== 'boolean' ||
    typeof ch !== 'string' ||
    typeof extId !== 'string') {

    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The user identifier in the conference.
   *
   * @property id
   * @type {string}
   * @required
   * @private
   */
  var id = userId;

  /**
   * The user name.
   *
   * @property name
   * @type {string}
   * @private
   */
  var name = '';

  /**
   * The identifier of the extension.
   *
   * @property extenId
   * @type {string}
   * @private
   */
  var extenId = extId;

  /**
   * The remote site name.
   *
   * @property site
   * @type {string}
   * @private
   */
  var site;

  /**
   * The remote site prefix.
   *
   * @property prefix
   * @type {string}
   * @private
   */
  var prefix;

  /**
   * The asterisk channel of the extension.
   *
   * @property channel
   * @type {string}
   * @private
   */
  var channel = ch;

  /**
   * True if the user is the owner of the conference.
   *
   * @property owner
   * @type {boolean}
   * @private
   */
  var owner = ownerValue;

  /**
   * The muted status of the user.
   *
   * @property muted
   * @type {boolean}
   * @private
   */
  var muted;

  /**
   * Returns true if the user is mute.
   *
   * @method isMute
   * @return {boolean} True if the user is mute.
   */
  function isMute() {
    return muted;
  }

  /**
   * Returns true if the user is the owner of the conference.
   *
   * @method isOwner
   * @return {boolean} True if the user is the owner of the conference.
   */
  function isOwner() {
    return owner;
  }

  /**
   * Returns the user id.
   *
   * @method getId
   * @return {string} The user id.
   */
  function getId() {
    return id;
  }

  /**
   * Returns the extension id.
   *
   * @method getExtenId
   * @return {string} The extension id.
   */
  function getExtenId() {
    return extenId;
  }

  /**
   * Returns the asterisk channel of the extension.
   *
   * @method getChannel
   * @return {string} The asterisk channel of the extension.
   */
  function getChannel() {
    return channel;
  }

  /**
   * Returns the user name.
   *
   * @method getName
   * @return {string} The user name.
   */
  function getName() {
    return name;
  }

  /**
   * Sets the user name.
   *
   * @method setName
   * @param {string} value The name
   */
  function setName(value) {
    name = value;
  }

  /**
   * Sets the remote site name.
   *
   * @method setRemoteSiteName
   * @param {string} value The name
   */
  function setRemoteSiteName(value) {
    site = value;
  }

  /**
   * Sets the remote site prefix.
   *
   * @method setRemoteSitePrefix
   * @param {string} value The prefix
   */
  function setRemoteSitePrefix(value) {
    prefix = value;
  }

  /**
   * Gets the remote site prefix.
   *
   * @method getRemoteSitePrefix
   * @return {string} The prefix.
   */
  function getRemoteSitePrefix() {
    return prefix;
  }

  /**
   * Sets the muted status.
   *
   * @method setMuted
   * @param {boolean} value The muted status
   */
  function setMuted(value) {
    muted = value;
  }

  /**
   * Return the readable string description of the member.
   *
   * @method toString
   * @return {string} The readable description of the extension
   */
  function toString() {
    return 'Meetme conference user: ' + getId() + ' - ' + getExtenId();
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         id: "1",
   *         name: "202",
   *         site: "nethesis",
   *         prefix: "4",
   *         owner: true,
   *         muted: false,
   *         extenId: "202"
   *     }
   *
   * @method toJSON
   * @return {object} The JSON representation of the object.
   */
  function toJSON() {
    return {
      id: id,
      name: name,
      site: site,
      owner: owner,
      muted: muted,
      prefix: prefix,
      extenId: extenId
    };
  }

  // public interface
  return {
    getId: getId,
    isMute: isMute,
    toJSON: toJSON,
    setName: setName,
    getName: getName,
    isOwner: isOwner,
    setMuted: setMuted,
    getChannel: getChannel,
    getExtenId: getExtenId,
    setRemoteSiteName: setRemoteSiteName,
    setRemoteSitePrefix: setRemoteSitePrefix,
    getRemoteSitePrefix: getRemoteSitePrefix
  };
};
