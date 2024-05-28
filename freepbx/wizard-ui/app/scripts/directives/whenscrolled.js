'use strict';

/**
 * @ngdoc directive
 * @name nethvoiceWizardUiApp.directive:whenScrolled
 * @description
 * # whenScrolled
 */
angular.module('nethvoiceWizardUiApp')
  .directive('whenScrolled', function () {
    return function(scope, elm, attr) {
      var raw = elm[0]

      elm.bind('scroll', function() {
        if ((raw.scrollTop + raw.offsetHeight) >= (raw.scrollHeight - 100)) {
          scope.$apply(attr.whenScrolled)
        }
      })
    }
  })
  