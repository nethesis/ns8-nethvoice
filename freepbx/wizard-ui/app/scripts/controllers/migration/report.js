'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:ReportmigrationCtrl
 * @description
 * # ReportmigrationCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('ReportmigrationCtrl', function ($scope, $location, $filter, MigrationService) {

    $scope.migration = migrationConfig.LABEL_INFO;
    $scope.report = {};

    $scope.getReport = function () {
      MigrationService.getReport().then(function (res) {
        $scope.view.changeRoute = false;
        $scope.report = res.data;
      }, function (err) {
        console.log(err);
      });
    }

    $scope.getReport();
    $scope.redirectOnMigrationStatus();

  });
