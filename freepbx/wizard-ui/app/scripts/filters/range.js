'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:range
 * @function
 * @description
 * # range
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('range', function() {
    return function(input, total) {
      total = parseInt(total);
      for (var i=0; i<total; i++) {
        input.push(i);
      }
      return input;
    };
  });



