/**
 * Abstraction of an email account.
 *
 * **It can throw exceptions.**
 *
 * @class EndpointEmail
 * @param  {string} identifier The email account
 * @return {object} The email endpoint object.
 * @constructor
 */
exports.EndpointEmail = function(identifier) {
  // check the parameter
  if (typeof identifier !== 'string') {
    throw new Error('wrong parameter');
  }

  /**
   * The email account identifier.
   *
   * @property id
   * @type {string}
   * @required
   * @private
   */
  var id = identifier;

  /**
   * Returns the email account identifier.
   *
   * @method getId
   * @return {string} The email account identifier.
   */
  function getId() {
    return id;
  }

  /**
   * Returns the readable string of the email account endpoint.
   *
   * @method toString
   * @return {string} The readable description of the email account endpoint.
   */
  function toString() {
    return 'Email account "' + getId() + '"';
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
