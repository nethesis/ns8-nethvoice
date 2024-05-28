'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:ellipsis
 * @function
 * @description
 * # ellipsis
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('ellipsis', function () {
    return function (input, width) {
      return (window.screen.width < width && window.screen.width >= 768) ? input.substring(0, 3) + '...' : input;
    };
  });
