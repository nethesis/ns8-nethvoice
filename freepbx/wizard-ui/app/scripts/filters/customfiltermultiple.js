'use strict';

/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:customFilterMultiple
 * @function
 * @description
 * # customFilterMultiple
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('customFilterMultiple', function () {
    return function (input, prop, search) {
      if (!input) return input;
      if (!search) return input;
      let expected = ('' + search).toLowerCase();
      let result = {};
      let propArr = prop.split(",");
      for (let p in propArr) {
        angular.forEach(input, function (value, key) {
          let actual = ('' + value[propArr[p]]).toLowerCase();
          if (actual.indexOf(expected) !== -1) {
            result[key] = value;
          }
          if (propArr[p] === 'dashboardUsersSearch') {
            angular.forEach(value['endpoints']['extension'], function (valueExt, keyExt) {
              if (valueExt['id'].indexOf(expected) !== -1) {
                result[key] = value;
              }
            });
          }
          if (propArr[p] === 'configurationsUsersSearch') {
            angular.forEach(value['devices'], function (valueExt, keyExt) {
              if ((valueExt['mac'] && valueExt['mac'].toLowerCase().indexOf(expected) !== -1) ||
              (valueExt['extension'] && valueExt['extension'].toLowerCase().indexOf(expected) !== -1)) {
                result[key] = value;
              }
            });
          }
        });
      }
      return result;
    }
  });
