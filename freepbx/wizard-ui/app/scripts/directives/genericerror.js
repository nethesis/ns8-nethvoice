'use strict';

/**
 * @ngdoc directive
 * @name nethvoiceWizardUiApp.directive:genericError
 * @description
 * # genericError
 */
angular.module('nethvoiceWizardUiApp')
  .directive('genericError', function () {
    return {
      templateUrl: 'scripts/directives/generic-error.html',
      controller: function($scope, $route, $location) {
        $scope.reset = function() {
          $scope.error.show = false;
        };
      }
    };
  });
