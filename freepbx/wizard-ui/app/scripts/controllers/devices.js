'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:DevicesCtrl
 * @description
 * # DevicesCtrl
 * Controller of the nethvoiceWizardUiApp
 */

angular.module('nethvoiceWizardUiApp')
  .controller('DevicesCtrl', function ($scope, ModelService, ConfigService, $location, $route, ProvGlobalsService) {

    $scope.view.changeRoute = true

    $scope.adminPw = {
      showAdminPwWarning: false
    }

    var currentStep = $route.current.controllerAs.split('/').length > 1 ? $route.current.controllerAs.split('/')[1] : $route.current.controllerAs.split('/')[0],
        stepCount = appConfig.STEP_MAP[currentStep],
        nextState = appConfig.STEP_WIZARD[currentStep].next

    var nextStep = function () {
      if (nextState && appConfig.STEP_WIZARD[currentStep].next) {
        $location.path(appConfig.STEP_WIZARD[currentStep].next)
        stepCount++
      }
      ConfigService.setWizard({
        status: 'true',
        step: stepCount
      }).then(function (res) {
      }, function (err) {
        console.log(err)
      });
      return appConfig.STEP_WIZARD[currentStep].next
    }

    $scope.openDefaultSettings = function () {
      $scope.loadingDefaults()
      $("#defaultSettingsModal").modal("show")
      setTimeout(function () {
        $('#defaultSettingsModal select').each(function(){
          if ($(this).hasClass("selectpicker")) {
            $(this).selectpicker('refresh')
          } else if ($(this).hasClass("combobox")) {
            $(this).combobox('refresh')
          }
        })
      }, 500)
    }

    var initDefaults = function (defaultRes) {
      $scope.$parent.defaultSettings = defaultRes.data
      $scope.$parent.storedDefaultSettings = angular.copy(defaultRes.data)
      $scope.adminPw.origValue = defaultRes.data.adminpw
      $scope.adminPw.showAdminPwWarning = false
      $scope.connectivityCheck({
        "host": defaultRes.data.hostname,
        "scheme": defaultRes.data.provisioning_url_scheme
      })
      $scope.ldapCheck()
      $scope.$parent.wizard.isNextDisabled = $scope.defaultSettings.ui_first_config ? true : false
      $scope.view.changeRoute = false
    }

    var init = function () {
      ModelService.getDefaults().then(function (defaultRes) {
        ConfigService.getWizard().then(function (res) {
          let isWizard
          if (res.length == 0) {
            isWizard = true;
          } else {
            isWizard = res[0].status === 'true';
          }
          if (isWizard) {
            initDefaults(defaultRes)
          } else {
            $location.path("/devices/inventory")
          }
        }, function (err) {
          console.log(err);
        })
      }, function (err) {
        console.log(err)
      })
    }

    $scope.$on('$routeChangeStart', function() {
      $scope.$parent.wizard.isNextDisabled = false
    })

    init()

  });
