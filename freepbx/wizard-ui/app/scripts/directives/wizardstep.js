'use strict';

/**
 * @ngdoc directive
 * @name nethvoiceWizardUiApp.directive:WizardStep
 * @description
 * # WizardStep
 */
angular.module('nethvoiceWizardUiApp')
  .directive('wizardStep', function () {
    return {
      templateUrl: 'scripts/directives/wizard-step.html',
      controller: function ($scope, $route, $location, $attrs, ConfigService) {

        $scope.isNextDisabled = $scope.wizard.isNextDisabled
        $scope.currentStep = $route.current.controllerAs.split('/').length > 1 ? $route.current.controllerAs.split('/')[1] : $route.current.controllerAs.split('/')[0]
        $scope.wizard.stepCount = appConfig.STEP_MAP[$scope.currentStep];
        $scope.wizard.prevState = appConfig.STEP_WIZARD[$scope.currentStep].prev;
        $scope.wizard.nextState = appConfig.STEP_WIZARD[$scope.currentStep].next;

        if (!appConfig.STEP_WIZARD[$scope.currentStep].next && appConfig.STEP_WIZARD[$scope.currentStep].last) {
          $scope.endWizard = true;
        }
        if (($scope.wizard.nextState == "admin/settings" || $scope.wizard.nextState == "devices")) {
          $scope.wizard.nextState = false;
        }

        $scope.resolveProgress = function () {
          return Math.floor($scope.wizard.stepCount * 100 / appConfig.TOTAL_STEP);
        };

        $scope.finalize = function() {
           ConfigService.setWizard({
            status: 'false',
            step: $scope.wizard.stepCount
          }).then(function (res) {
            $location.path('/final');
          }, function (err) {
            console.log(err);
          });
        }

        $scope.prevStep = function () {
          if (appConfig.STEP_WIZARD[$scope.currentStep].prev) {
            $location.path(appConfig.STEP_WIZARD[$scope.currentStep].prev);
            $scope.wizard.stepCount--;
          }
          ConfigService.setWizard({
            status: 'true',
            step: $scope.wizard.stepCount
          }).then(function (res) {
          }, function (err) {
            console.log(err);
          });
          return appConfig.STEP_WIZARD[$scope.currentStep].prev;
        };

        $scope.nextStep = function () {
          if ($scope.wizard.nextState && appConfig.STEP_WIZARD[$scope.currentStep].next) {
            $location.path(appConfig.STEP_WIZARD[$scope.currentStep].next);
            $scope.wizard.stepCount++;
          }
          ConfigService.setWizard({
            status: 'true',
            step: $scope.wizard.stepCount
          }).then(function (res) {
          }, function (err) {
            console.log(err);
          });
          return appConfig.STEP_WIZARD[$scope.currentStep].next;
        };
      }
    };
  });
