'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:profileList
 * @function
 * @description
 * # profileList
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('profileList', function () {
    return function (input) {
      var filtered = [];
      angular.forEach(input, function (item) {
        if (item.id) {
          filtered.push(item);
        }
      });
      return filtered;
    }
  });
