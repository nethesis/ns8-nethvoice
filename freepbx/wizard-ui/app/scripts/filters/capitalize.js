'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:capitalize
 * @function
 * @description
 * # capitalize
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('capitalize', function() {
    return function(input) {
      if (input === undefined) {
        return '';
      }
      if (input != null)
        input = input.toLowerCase();
      return input.substring(0, 1).toUpperCase() + input.substring(1);
    };
  });