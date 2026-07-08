/**
 * Provides common utilities functions.
 *
 * @class util
 * @static
 */

/**
 * Checks if an IP address is private.
 *
 * @method isPrivateIP
 * @static
 * @param  {string} ip The IP address to check
 * @return {boolean} True if the IP is private, otherwise False.
 */
function isPrivateIP(ip) {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
  ];

  return privateRanges.some((range) => range.test(ip));
}

// public interface
exports.isPrivateIP = isPrivateIP;
