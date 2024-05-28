'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:AppsStreamingCtrl
 * @description
 * # AppsStreamingCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('AppsStreamingCtrl', function ($scope, ProfileService, ApplicationService, UserService) {
    $scope.allSources = [];
    $scope.allProfiles = [];
    $scope.newSource = {
      verified: false,
      isChecking: false,
      checked: false,
      showPass: false
    };
    $scope.currentSource = {};
    $scope.users = [];

    $scope.selectSource = function (s) {
      $scope.currentSource = s;
    };
    $scope.saveSource = function (s) {
      s.onSave = true;
      // clean useless data
      delete s.checked;
      delete s.isChecking;
      delete s.onSave;
      delete s.verified;
      if (s.onMod) {
        ApplicationService.updateVideoSource(s.descr, s).then(function (res) {
          s.onSave = false;
          $scope.onSaveSuccessSource = true;
          $scope.onSaveErrorSource = false;
          $scope.getSourceList();
          $scope.newSource = {
            verified: false,
            isChecking: false,
            checked: false
          };
          $scope.checkConnection(s);
          $('#newSourceModal').modal('hide');

        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessSource = false;
          $scope.onSaveErrorSource = true;
          $('#newSourceModal').modal('hide');
          console.log(err);
        });
      } else {
        ApplicationService.createVideoSource(s).then(function (res) {
          s.onSave = false;
          $scope.onSaveSuccessSource = true;
          $scope.onSaveErrorSource = false;
          $scope.getSourceList();
          $scope.newSource = {
            verified: false,
            isChecking: false,
            checked: false
          };
          $scope.checkConnection(s);
          $('#newSourceModal').modal('hide');
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessSource = false;
          $scope.onSaveErrorSource = true;
          $('#newSourceModal').modal('hide');
          console.log(err);
        });
      }
    };
    $scope.deleteSource = function (s) {
      s.onSave = true;
      ApplicationService.deleteVideoSource(s.descr).then(function (res) {
        s.onSave = false;
        $scope.getSourceList();
        $('#deleteModal').modal('hide');
      }, function (err) {
        s.onSave = false;
        console.log(err);
      });
    };
    $scope.cancelSource = function (s) {
      $scope.newSource = {
        verified: false,
        isChecking: false,
        checked: false
      };
      s = $scope.newSource;
      s.onMod = false;
    };
    $scope.modifySource = function (s) {
      s.onMod = true;
      $scope.newSource = s;
      $scope.newSource.currentDescr = s.descr;
    };

    $scope.checkConnection = function (s) {
      s.isChecking = true;
      ApplicationService.checkConnectionVideoSource({
        url: s.url
      }).then(function (res) {
        s.checked = true;
        s.isChecking = false;
        s.verified = true;
        s.preview = 'data:image/png;base64,' + res.data;
      }, function (err) {
        s.checked = true;
        s.isChecking = false;
        s.verified = false;
        console.log(err);
      });
    };

    $scope.getSourceList = function () {
      ApplicationService.allVideoSources().then(function (res) {
        $scope.allSources = res.data;
        $scope.view.changeRoute = false;
        for (var s in $scope.allSources) {
          $scope.checkConnection($scope.allSources[s]);
        }
      }, function (err) {
        $scope.view.changeRoute = false;
        console.log(err);
      });
    };

    $scope.getUserList = function () {
      $scope.view.changeRoute = true;
      ApplicationService.allExtensions().then(function (res) {
        $scope.users = res.data;
        $scope.getSourceList();
      }, function (err) {
        $scope.users = [];
        $scope.view.changeRoute = false;
        console.log(err);
      });
    };

    $scope.getAllProfiles = function () {
      ProfileService.allProfiles().then(function (res) {
        $scope.allProfiles = res.data;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.$on( "$routeChangeSuccess", function(event, next, current) {
      if (next.templateUrl === 'views/apps/streaming.html') {
        $scope.getUserList();
        $scope.getAllProfiles();
      }
    });

    $scope.$on('loginCompleted', function (event, args) {
      $scope.getUserList();
      $scope.getAllProfiles();
    });
  });
