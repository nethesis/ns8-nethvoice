'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:trustUrl
 * @function
 * @description
 * # trustUrl
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('trustUrl', function ($sce) {
    return function (url) {
      return $sce.trustAsResourceUrl(url);
    };
  });
