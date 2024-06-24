'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:blacklistfilter
 * @function
 * @description
 * # capitalize
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('blacklistFilterNoKeyDsp', function() {
    return function(options, blacklist) {
      if (blacklist) {
        for (let option in options) {
          if (blacklist.includes(options[option].toString())) {
            options.pop()
          }
        }
      }
      return options
    }
  })