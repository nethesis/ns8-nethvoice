'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:AdminLanguagesCtrl
 * @description
 * # AdminLanguagesCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('AdminLanguagesCtrl', function ($scope, $interval, LanguageService, UtilService, ConfigService, LocalStorageService) {
    $scope.taskPromise = null;
    $scope.currentProgress = 0;
    $scope.errorCount = 0;
    $scope.defaultLanguage = "";
    $scope.startInstallation = false;
    $scope.currentLanguage = "";
    $scope.language = LocalStorageService.get('preferredLanguage');
    $scope.availableLangs = ['it', 'en', 'fr', 'de', 'es'];

    $scope.$on('$destroy', function () {
      $interval.cancel($scope.taskPromise);
    });

    $scope.getLangName = function (key) {
      return LanguageService.getNativeName(key);
    }

    $scope.getLanguageList = function (reload) {
      $scope.view.changeRoute = reload;
      LanguageService.getInstalledLanguages().then(function (res) {
        for (var l in res.data) {
          if (res.data[l].default == true) {
            $scope.language = l;
            $scope.currentLanguage = l;
            $scope.wizard.nextState = true;
            $scope.view.changeRoute = false;
          } else {
            $scope.view.changeRoute = false;
          }
        }
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    }

    $scope.setDefaultPBXLanguage = function (lang) {
      $scope.startInstallation = true;
      $scope.currentProgress = 0;
      $scope.onSaveSuccess = false;
      $scope.onSaveError = false;
      $scope.wizard.nextState = true;

      // set default language
      ConfigService.setDefaultPBXLang({
        lang: lang
      }).then(function (res) {
        $scope.currentLanguage = $scope.language;
        $scope.onSaveSuccess = true;
        $scope.onSaveError = false;
      }, function (err) {
        console.error(err);
        $scope.onSaveSuccess = false;
        $scope.onSaveError = true;
      });
    };

    $scope.getLanguageList(true);
  });
