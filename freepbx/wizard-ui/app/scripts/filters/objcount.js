'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:objCount
 * @function
 * @description
 * # objCount
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('objCount', function() {
    return function(input) {
      var total = 0;
      for (var o in input) {
        total += Object.keys(input[o]).length;
      }
      return total;
    };
  });