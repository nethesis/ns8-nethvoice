'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:toBase64
 * @function
 * @description
 * # toBase64
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('toBase64', function () {
    return function (input) {
      if (input === null || input === undefined) {
        return '';
      }
      return btoa(unescape(encodeURIComponent(input)));
    };
  });
