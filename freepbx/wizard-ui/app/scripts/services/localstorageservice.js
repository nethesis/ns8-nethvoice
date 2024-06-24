'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.LocalStorageService
 * @description
 * # LocalStorageService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('LocalStorageService', function($window, $rootScope) {
    this.set = function(itemName, val) {
      if ($window.localStorage)
        $window.localStorage.setItem(itemName, JSON.stringify(val));
    };

    this.get = function(itemName, jsonSkip) {
      if ($window.localStorage.getItem(itemName) && $window.localStorage.getItem(itemName) !== 'undefined' && $window.localStorage.getItem(itemName) != undefined) {
        var val = $window.localStorage.getItem(itemName) || '';
        return jsonSkip ? val : JSON.parse(val);
      } else {
        return '';
      }
    };

    this.remove = function(itemName) {
      if ($window.localStorage)
        $window.localStorage.removeItem(itemName);
    };
  });