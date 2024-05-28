'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:maskToCidr
 * @function
 * @description
 * # maskToCidr
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('maskToCidr', function(UtilService) {
    return function(input) {
      return UtilService.maskToCidr(input);
    };
  });