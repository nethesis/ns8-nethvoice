/**
 * Provides common operations for all asterisk actions.
 *
 * @class action
 * @static
 */

/**
 * Separator character to construct ActionID key of the asterisk action.
 *
 * @property SEP
 * @type string
 * @default '_'
 * @final
 * @readOnly
 * @private
 */
var SEP = '_';

/**
 * Returns the value for the ActionID key of the asterisk action.
 *
 * @method getActionId
 * @static
 * @param  {string} id The name for the action
 * @return {string} Unique value for the ActionID key.
 * The value is: id + _ + timestamp
 */
function getActionId(id) {
  if (id) {
    return id + SEP + (new Date()).getTime() + SEP + Math.floor(Math.random() * 10000);
  }
  return (new Date()).getTime() + SEP + Math.floor(Math.random() * 10000);
}

/**
 * Returns the action name from the ActionID key of the asterisk action.
 *
 * @method getActionName
 * @static
 * @param {sring} actionid The value of the ActionID key
 * @return {string} The name of the action or undefined
 */
function getActionName(actionid) {
  if (actionid && actionid.indexOf(SEP) !== -1) {
    return actionid.split(SEP)[0];
  }
  return undefined;
}

// public interface
exports.getActionId = getActionId;
exports.getActionName = getActionName;
