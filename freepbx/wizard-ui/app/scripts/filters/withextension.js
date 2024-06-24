'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:withExtension
 * @function
 * @description
 * # withExtension
 * Filter in the nethvoiceWizardUiApp.
 */

angular.module('nethvoiceWizardUiApp')
  .filter('withExtension', function () {
    return function (input) {
      if (!input) return input;
      var result = []
      angular.forEach(input, function (value, key) {
        if (value.default_extension != 'none' && value.default_extension != '') {
          result.push(value);
        }
      });
      return result;
    }
  });
