'use strict';

/**
 * @ngdoc directive
 * @name nethvoiceWizardUiApp.directive:onFinishRender
 * @description
 * # resizer
 */
angular.module('nethvoiceWizardUiApp')
  .directive('onFinishRenderRevised', function ($timeout, $rootScope) {
    return {
      restrict: 'A',
      link: function (scope, element, attr) {
        if (scope.$last === true || attr.forcerendering) {
          $timeout(function () {
            $rootScope.$emit(attr.onFinishRenderRevised, attr.parentid)
          })
        }
      }
    }
  })