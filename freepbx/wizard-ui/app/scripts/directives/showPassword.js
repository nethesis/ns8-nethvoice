'use strict';

/**
 * @ngdoc directive
 * @name nethvoiceWizardUiApp.directive:ShowPassword
 * @description
 * # showPassword
 */
angular.module('nethvoiceWizardUiApp')
  .directive('showPassword', function () {
    return function linkFn(scope, elem, attrs) {
      scope.$watch(attrs.showPassword, function(newValue) {
          if (newValue) {
              elem.attr("type", "text");
          } else {
              elem.attr("type", "password");
          };
      });
    };
  });
