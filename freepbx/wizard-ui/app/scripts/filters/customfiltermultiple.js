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
    var normalizeMac = function (value) {
      return ('' + (value || '')).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    };

    var toArray = function (input) {
      if (angular.isArray(input)) {
        return input;
      }

      var result = [];
      angular.forEach(input, function (value) {
        result.push(value);
      });
      return result;
    };

    return function (input, prop, search) {
      if (!input) return input;
      var source = toArray(input);
      if (!search) return source;
      let expected = ('' + search).toLowerCase();
      let normalizedExpected = normalizeMac(search);
      let result = [];
      let propArr = prop.split(",");
      var addResult = function (value, key) {
        if (result.indexOf(value) === -1) {
          result.push(value);
        }
      };

      for (let p in propArr) {
        angular.forEach(source, function (value, key) {
          let actual = ('' + value[propArr[p]]).toLowerCase();
          if (actual.indexOf(expected) !== -1) {
            addResult(value, key);
          }
          if (propArr[p] === 'dashboardUsersSearch') {
            angular.forEach(value['endpoints']['extension'], function (valueExt, keyExt) {
              if (valueExt['id'].indexOf(expected) !== -1) {
                addResult(value, key);
              }
            });
          }
          if (propArr[p] === 'configurationsUsersSearch') {
            angular.forEach(value['devices'], function (valueExt, keyExt) {
              let mac = valueExt['mac'];
              let extension = valueExt['extension'];
              let matchesRawMac = !!(mac && mac.toLowerCase().indexOf(expected) !== -1);
              let matchesNormalizedMac = !!(mac && normalizedExpected && normalizeMac(mac).indexOf(normalizedExpected) !== -1);
              let matchesExtension = !!(extension && extension.toLowerCase().indexOf(expected) !== -1);
              if (matchesRawMac || matchesNormalizedMac || matchesExtension) {
                addResult(value, key);
              }
            });
          }
        });
      }
      return result;
    }
  });
