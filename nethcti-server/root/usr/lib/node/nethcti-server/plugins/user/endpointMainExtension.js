/**
 * Abstraction of a main extension endpoint.
 *
 * **It can throw exceptions.**
 *
 * @class EndpointMainExtension
 * @param {string} identifier The main extension identifier
 * @return {object} The main extension endpoint object.
 * @constructor
 */
exports.EndpointMainExtension = function(identifier) {
  // check the parameter
  if (typeof identifier !== 'string') {
    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The main extension identifier.
   *
   * @property id
   * @type {string}
   * @required
   * @private
   */
  var id = identifier;

  /**
   * Return the main extension identifier.
   *
   * @method getId
   * @return {string} The main extension identifier
   */
  function getId() {
    return id;
  }

  /**
   * Return the readable string of the main extension endpoint.
   *
   * @method toString
   * @return {string} The readable description of the main extension endpoint.
   */
  function toString() {
    return 'MainExtension "' + getId() + '"';
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         id: "214"
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
