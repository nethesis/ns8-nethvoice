'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:MigrationCtrl
 * @description
 * # MigrationCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('MigrationCtrl', function ($scope, $location) {
    $scope.view.changeRoute = false;

    $scope.startMigration = function () {
      $location.path('/migration/users');
      $scope.wizard.fromMigrationStart = true;
    }

    $scope.skipMigration = function () {
      $location.path('/migration/cdr');
      $scope.wizard.isMigrationSkip = true;
    }

    $scope.redirectOnMigrationStatus();
  });
