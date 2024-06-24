'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:regexpParse
 * @function
 * @description
 * # regexpParse
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('regexpParse', function () {
    return function (input) {
      return input && input.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
    };
  });
