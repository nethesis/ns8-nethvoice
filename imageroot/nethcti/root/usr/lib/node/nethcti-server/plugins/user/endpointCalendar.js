// /**
//  * Abstraction of a calendar endpoint.
//  *
//  * **It can throw exceptions.**
//  *
//  * @class EndpointCalendar
//  * @param {string} identifier The calendar identifier
//  * @constructor
//  * @return {object} The endpoint calendar object.
//  */
// exports.EndpointCalendar = function(identifier) {
//   if (typeof identifier !== 'string') {
//     throw new Error('wrong parameter');
//   }

//   /**
//    * The calendar identifier.
//    *
//    * @property id
//    * @type {string}
//    * @required
//    * @private
//    */
//   var id = identifier;

//   /**
//    * Return the calendar identifier.
//    *
//    * @method getId
//    * @return {string} The calendar identifier
//    */
//   function getId() {
//     return id;
//   }

//   /**
//    * Return the readable string of the calendar endpoint.
//    *
//    * @method toString
//    * @return {string} The readable description of the calendar endpoint.
//    */
//   function toString() {
//     return 'Calendar "' + getId() + '"';
//   }

//   /**
//    * Returns the JSON representation of the object.
//    *
//    *     {
//    *         id: "alessandro.polidori@gmail.com"
//    *     }
//    *
//    * @method toJSON
//    * @return {object} The JSON representation of the object.
//    */
//   function toJSON() {
//     return {
//       id: id
//     };
//   }

//   // public interface
//   return {
//     getId: getId,
//     toJSON: toJSON,
//     toString: toString
//   };
// };
