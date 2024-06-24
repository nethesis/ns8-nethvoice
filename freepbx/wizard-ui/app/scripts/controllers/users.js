'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:UsersCtrl
 * @description
 * # UsersCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('UsersCtrl', function ($scope, $location, $interval, ConfigService, UtilService) {
    $scope.showConfigSwitch = false;
    $scope.startInstall = false;
    $scope.currentProgress = 0;
    $scope.selectedMode = '';
    $scope.errorCount = 0;

    $scope.nextStepUsers = function () {
      var step = $scope.wizard.stepCount;
      $location.path("/extensions");
      if (!step || (step && step == "0")) {
        ConfigService.setWizard({
          status: 'true',
          step: '1'
        }).then(function (res) {
        }, function (err) {
          console.log(err);
        });
      }
    }

    $scope.getProviderStatus = function () {
      ConfigService.getConfig().then(function(res) {
        if (res.data.configured === 0) {
          $scope.view.changeRoute = false;
          $scope.showConfigSwitch = true;
        } else {
          if (res.data.type === 'ldap') {
            $scope.mode.isLdap = true;
            $scope.nextStepUsers();
          } else {
            $scope.mode.isLdap = false;
            $scope.nextStepUsers();
          }
        }
      }, function(err) {
        console.log(err);
      });
    }

    $scope.goNethserverSssdConfig = function () {
      window.location.href = window.location.origin + ":9090/nethserver#/users-groups";
    };

    $scope.makeChoice = function (mode) {
      if (!$scope.startInstall) {
        $scope.selectedMode = mode;
        $scope.startInstall = true;

        ConfigService.setConfig(mode).then(function (res) {
          if (mode === 'legacy') {
            $('#uc-button').addClass('disabled');
              $scope.errorCount = 0;
              $scope.mode.isLdap = true;

              if ($scope.wizard.isMigration) {
                $scope.wizard.isMigrationView = true;
                $scope.wizard.isWizard = false;
                $location.path('/migration');
              }
          } else {
            $('#legacy-button').addClass('disabled');
          }
        }, function (err) {
          console.log(err);
        });
      }
    };

    $scope.getProviderStatus();

  });
