'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:CdrmigrationCtrl
 * @description
 * # CdrmigrationCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('CdrmigrationCtrl', function ($scope, $location, $interval, MigrationService) {

    $scope.migration = {
      cdr : {
        id : 0,
        count: 0,
        started: false,
        loading: false,
        completed: false,
        status: 'todo',
        data: {}
      }
    }
    
    $scope.view.changeRoute = false;

    $scope.hideCdrModal = function () {
      $('#importModalMig').modal('hide');
    }
    
    $scope.startCdrMig = function () {
      $scope.migration.cdr.loading = true;
      $scope.migration.cdr.started = true;
      $scope.hideCdrModal();
      $scope.toggleMig("collapse-cdr");
      MigrationService.importCdr().then(function (res) {
        $scope.migration.cdr.data = res.data;
        $scope.slideDown("collapse-cdr");
        $scope.migration.cdr.status = "success";
        $scope.migration.cdr.loading = false;
      }, function (err) {
        console.log(err);
        $scope.migration.cdr.data = err.data;
        $scope.slideDown("collapse-cdr");
        $scope.migration.cdr.status = "fail";
        $scope.migration.cdr.loading = false;
      });
    }

    $scope.setMigraitonCdrStatus = function (status) {
      MigrationService.setMigrationStatus({"status": status}).then(function (res) {
        // status cdr set
      }, function (err) {
        console.log(err);
      });
    }

    $scope.goToReport = function (status) {
      if (status) {
        $scope.setMigraitonCdrStatus(status);
      }
      $location.path("/migration/report");
    }

    $scope.initCdr = function () {
      MigrationService.getCdrLength().then(function (res) {
        $scope.migration.cdr.count = res.data.count;
      }, function (err) {
        console.log(err);
      });
    }

    $scope.initCdr();
    if (!$scope.wizard.isMigrationSkip) {
      $scope.redirectOnMigrationStatus();
    }

  });
