'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:AdminSettingsCtrl
 * @description
 * # AdminSettingsCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('AdminSettingsCtrl', function ($scope, UserService, RestService, RestServiceCTI, ConfigService, ModelService) {
    $scope.wizard.isEnd = true
    $scope.view.changeRoute = false

    $scope.create = function () {
      if ($scope.admin.password === $scope.admin.confirmPassword) {
        UserService.setPassword('admin', {
          password: $scope.admin.password
        }).then(function (res) {
          var hash = RestService.getHash('admin', $scope.admin.password);
          RestService.setAuthHeader('admin', hash);
          RestServiceCTI.setAuthHeader('admin', hash);
          $scope.onSaveSuccess = true;
          $scope.onSaveError = false;
          if ($scope.wizard.isWizard ) {
            $scope.wizard.isEnd = true
          } 
        }, function (err) {
          $scope.onSaveSuccess = false;
          $scope.onSaveError = true;
        });
      } else {
        $scope.onSaveSuccess = false;
        $scope.onSaveError = true;
      }
    };

    var init = function () {
      $("#saveNat").on("hidden.bs.modal", function () {
        $scope.loadingNatAction = ""
      })
    }

    angular.element(document).ready(function () {
      init()
    })

  });
