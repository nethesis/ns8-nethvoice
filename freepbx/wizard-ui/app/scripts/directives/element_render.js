'use strict';

/**
 * @ngdoc directive
 * @name nethvoiceWizardUiApp.directive:onElementRender
 * @description
 * # resizer
 */
angular.module('nethvoiceWizardUiApp')
  .directive('onElementRender', function ($timeout) {
    return {
      restrict: 'A',
      link: function (scope, element, attr) {
        $timeout(function () {
          scope.$emit(attr.onElementRender, element)
        })
      }
    }
  })