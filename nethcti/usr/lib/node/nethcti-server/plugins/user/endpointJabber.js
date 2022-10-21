/**
 * Abstraction of a jabber account.
 *
 * **It can throw exceptions.**
 *
 * @class EndpointJabber
 * @constructor
 * @param {string} identifier The jabber account
 * @return {object} The jabber endpoint object.
 */
exports.EndpointJabber = function (identifier) {
  // check the parameter
  if (typeof identifier !== 'string') {
    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The jabber account identifier.
   *
   * @property id
   * @type {string}
   * @required
   * @private
   */
  var id = identifier;

  /**
   * Return the jabber account identifier.
   *
   * @method getId
   * @return {string} The jabber account identifier.
   */
  function getId() {
    return id;
  }

  /**
   * Return the readable string of the jabber account endpoint.
   *
   * @method toString
   * @return {string} The readable description of the jabber account endpoint.
   */
  function toString() {
    return 'Jabber account "' + getId() + '"';
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         id: "some.user@nethcti.com"
   *     }
   *
   * @method toJSON
   * @return {object} The JSON representation of the object.
   */
  function toJSON() {
    return {
      id: id
    };
  }

  // public interface
  return {
    getId: getId,
    toJSON: toJSON,
    toString: toString
  };
};
