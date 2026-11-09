/**
 * Abstraction of a cellphone endpoint.
 *
 * **It can throw exceptions.**
 *
 * @class EndpointCellphone
 * @param {string} identifier The cellphone number identifier
 * @constructor
 * @return {object} The endpoint cellphone object.
 */
exports.EndpointCellphone = function(identifier) {
  // check the parameter
  if (typeof identifier !== 'string') {
    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The cellphone number identifier.
   *
   * @property id
   * @type {string}
   * @required
   * @private
   */
  var id = identifier;

  /**
   * Return the cellphone number identifier.
   *
   * @method getId
   * @return {string} The cellphone number identifier
   */
  function getId() {
    return id;
  }

  /**
   * Return the readable string of the cellphone endpoint.
   *
   * @method toString
   * @return {string} The readable description of the cellphone endpoint.
   */
  function toString() {
    return 'Cellphone "' + getId() + '"';
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         id: "340123456"
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
