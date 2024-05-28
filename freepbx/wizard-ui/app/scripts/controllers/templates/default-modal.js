'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:DefaultModalUICtrl
 * @description
 * # DefaultModalUICtrl
 * Controller of the nethvoiceWizardUiApp
 */

angular.module('nethvoiceWizardUiApp')
  .controller('DefaultModalUICtrl', function ($scope, $interval, $location, ModelService) {

    $scope.openedSection = ""
    $scope.globalsUi = $scope.buildDefaultSettingsUI()
    $scope.selectOptionsLimit = 12
    $scope.loadingSections = []
    $scope.shownPasswords = {}

    var resetloadingActions = function (status) {
      $scope.loadingActions = status
      setTimeout(function () {
        $scope.loadingActions = false
        $scope.$apply()
      }, 2500)
    }

    $scope.setDefaultSettings = function () {
      $scope.loadingActions = true
      $scope.defaultSettings.ui_first_config = ""
      if ($scope.adminPw.origValue !== $scope.defaultSettings.adminpw) {
        ModelService.updateAdminPw({ password: $scope.defaultSettings.adminpw }).then(function (res) {
          console.log('update adminpw ok');
        }, function (err) {
          console.error('error updating adminpw');
          console.error(err);
        });
      }
      ModelService.setDefaults($scope.defaultSettings).then(function (res) {
        resetloadingActions("ok")
        $scope.startPhonebookService()
        $scope.enableNextDisabled()
        setTimeout(function () {
          $scope.$apply(function () {
            $("#defaultSettingsModal").modal("hide")
            // $scope.$parent.$parent.defaultSettings = {}
          })
        }, 1000)
      }, function (err) {
        resetloadingActions("err")
        console.log(err)
      })
    }

    $scope.isModelsPage = function () {
      if ($location.path() == "/devices/models") {
        return true
      } else {
        return false
      }
    }

    $scope.phonebookTypeChange = function () {
      $scope.$parent.$parent.phonebookType = document.querySelector("#phonebookType").value
      if ($scope.phonebookType == "ldaps") {
        $scope.ldapToDefaultVariables($scope.ldapCheckRes, true, false)
        // force encryption select disabling or enabling
        $("#default-select-4").prop('disabled', true)
      } else if ($scope.phonebookType == "ldap") {
        $scope.ldapToDefaultVariables($scope.ldapCheckRes, false, false)
        $("#default-select-4").prop('disabled', true)
      } else {
        $scope.$parent.$parent.defaultSettings = angular.copy($scope.storedDefaultSettings)
        $("#default-select-4").prop('disabled', false)
      }
      setTimeout(function () {
        $("#default-select-4").selectpicker("refresh")
      }, 100)
    }

    $scope.toggleShowPassword = function (variable) {
      $scope.shownPasswords[variable] ? delete $scope.shownPasswords[variable] : $scope.shownPasswords[variable] = true
    }

    $scope.pinnedChange = function (variable) {
      if (variable === "adminpw" && $scope.defaultSettings.adminpw !== $scope.adminPw.origValue) {
        $scope.adminPw.showAdminPwWarning = true;
      } else if (variable === "adminpw") {
        $scope.adminPw.showAdminPwWarning = false;
      }
      if (variable == "hostname") {
        $scope.connectivityCheck({
          "host": $scope.defaultSettings.hostname,
          "scheme": $scope.defaultSettings.provisioning_url_scheme
        })
      }
      if (variable == "provisioning_url_scheme" && $scope.defaultSettings["ui_first_config"]) {
        $scope.ldapCheck()
      }
      $scope.refreshGlobalsSelects()
    }

    $scope.openSection = function (sectionkey) {
      $scope.destroyAllSelects(".globalsSectionContainer")
      $scope.selectOptionsLimit = 12
      $interval.cancel($scope.selectOptionsInterval)
      $scope.selectOptionsInterval = $interval(function (index) {
        $scope.selectOptionsLimit += 10
        if (index == 5 || index == 10  || index == 15 || index == 20 || index == 25 || index == 30 || index == 35 || index == 42) {
          $scope.refreshGlobalsSelects()
        }
      }, 1000, 43)
      if ($scope.openedSection != sectionkey) {
        $scope.openedSection = sectionkey
      } else {
        $scope.openedSection = ""
        $interval.cancel($scope.selectOptionsInterval)
      }
    }

  })
