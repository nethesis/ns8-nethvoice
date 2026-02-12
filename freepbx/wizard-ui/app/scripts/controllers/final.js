'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:FinalCtrl
 * @description
 * # FinalCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('FinalCtrl', function ($scope, $filter, UserService) {
    $scope.wizard.isWizard = false;
    $scope.customConfig = customConfig;

  });
