/**
 * Abstraction of a group of users in the operator panel.
 *
 * **It can throw exceptions.**
 *
 * @class Group
 * @param {string} groupName The group name
 * @constructor
 * @return {object} The group object.
 */
exports.Group = function(groupName) {
  // check the parameter
  if (typeof groupName !== 'string') {
    throw new Error('wrong parameter');
  }

  /**
   * The group name.
   *
   * @property name
   * @type {string}
   * @required
   * @private
   */
  var name = groupName;

  /**
   * The list of the users that belongs to the group. The keys
   * are the usernames. The value is not used. It uses an
   * object instead of an array for convenience of code.
   *
   * @property users
   * @type {object}
   * @default {}
   * @private
   */
  var users = {};

  /**
   * Return the group name.
   *
   * @method getName
   * @return {string} The name of the group
   */
  function getName() {
    return name;
  }

  /**
   * Return the number of the user members.
   *
   * @method userCount
   * @return {number} The number of the user members.
   */
  function userCount() {
    return Object.keys(users).length;
  }

  /**
   * Adds users to the group.
   *
   * @method addUsers
   * @param {array} arr The list of usernames as strings
   */
  function addUsers(arr) {
    // check parameter
    if (!(arr instanceof Array)) {
      throw new Error('wrong parameter');
    }

    // add all users to users property
    var i;
    for (i = 0; i < arr.length; i++) {
      users[arr[i]] = '';
    }
  }

  /**
   * Returns the list of the users of the group.
   *
   * @method getUserList
   * @return {array} The list of the users of the group.
   */
  function getUserList() {
    return Object.keys(users);
  }

  /**
   * Returns the readable string of the group.
   *
   * @method toString
   * @return {string} The readable description of the group
   */
  function toString() {
    return 'Opertor panel group "' + getName() + '": ' + userCount() + ' user members';
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         name: "Developer"          // the group name
   *         users: ["alessandro", "giovanni"] // the list of the users that belongs to the group
   *     }
   *
   * @method toJSON
   * @return {object} The JSON representation of the object.
   */
  function toJSON() {
    return {
      name: name,
      users: Object.keys(users)
    };
  }

  // public interface
  return {
    toJSON: toJSON,
    getName: getName,
    toString: toString,
    addUsers: addUsers,
    userCount: userCount,
    getUserList: getUserList
  };
};
