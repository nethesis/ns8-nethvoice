/**
 * The test for the mailer component.
 *
 * @module mailer
 * @submodule test
 */

/**
 * **Temporary test**
 *
 * Test for the mailer.js file
 *
 * @class test_mailer
 * @static
 */
const mailer = require('../mailer');
mailer.setLogger({ log: console });

/**
 * Line command arguments.
 *
 * @property args
 * @type array
 * @private
 */
let args;

(function () {
  try {
    args = process.argv.splice(2);
    mailer.config('/etc/nethcti/mailer.json');
    test_send();
  } catch (err) {
    console.log(err.stack);
  }
})();

/**
 * Test for the send method.
 *
 * @method test_send
 * @private
 */
async function test_send() {
  try {
    let to = args[0];
    let body = args[2];
    let subject = args[1];
    let info = await mailer.send(to, body, subject);
    console.log(info);
  } catch (err) {
    console.log(err.stack);
  }
}
