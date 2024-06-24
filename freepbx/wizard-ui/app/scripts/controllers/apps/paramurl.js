'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:AppsParamurlCtrl
 * @description
 * # AppsStreamingCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('AppsParamurlCtrl', function ($rootScope, $scope, ProfileService, ApplicationService, UserService) {
    $scope.allUrls = [];
    $scope.newUrl = {
      url: '',
      profiles: [],
      only_queues: false
    };
    $scope.currentUrl = {};
    $scope.users = [];
    $scope.tdata = {
      allProfiles: [],
      busyProfiles: [],
      dataLoaded: false
    };

    $scope.selectUrl = function (s) {
      $scope.currentUrl = s;
    };

    $scope.saveParamurl = function (s) {
      s.onSave = true;
      // clean useless data
      delete s.onSave;
      if (s.onMod) {
        ApplicationService.updateParamUrl(s).then(function (res) {
          s.onSave = false;
          $scope.onSaveSuccessSource = true;
          $scope.onSaveErrorSource = false;
          $('#newParamurlModal').modal('hide');
          $scope.cancelParamurl();
          $scope.getParamUrls();
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessSource = false;
          $scope.onSaveErrorSource = true;
          $('#newParamurlModal').modal('hide');
          console.log(err);
        });
      } else {
        ApplicationService.createParamUrl(s).then(function (res) {
          s.onSave = false;
          $scope.onSaveSuccessSource = true;
          $scope.onSaveErrorSource = false;
          $('#newParamurlModal').modal('hide');
          $scope.cancelParamurl();
          $scope.getParamUrls();
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessSource = false;
          $scope.onSaveErrorSource = true;
          $('#newParamurlModal').modal('hide');
          console.log(err);
        });
      }
    };

    $scope.deleteUrl = function (s) {
      s.onSave = true;
      ApplicationService.deleteParamUrl({ url: s.url, profiles: s.profiles }).then(function (res) {
        s.onSave = false;
        $scope.cancelParamurl();
        $scope.getParamUrls();
        $('#deleteModal').modal('hide');
      }, function (err) {
        s.onSave = false;
        console.log(err);
      });
    };

    $scope.cancelParamurl = function (s) {
      $scope.newUrl = { url: '', profiles: [], only_queue: false };
      s = $scope.newUrl;
      s.onMod = false;
    };

    $scope.modifyUrl = function (s) {
      s.onMod = true;
      $scope.newUrl = angular.copy(s);
    };

    $scope.getParamUrls = function () {
      ApplicationService.getParamUrls().then(function (res) {
        $scope.allUrls = res.data;
        $scope.allUrlProfiles = {}
        $scope.view.changeRoute = false;
        $scope.tdata.busyProfiles = [];
        for (var i = 0; i < $scope.allUrls.length; i++) {
          $scope.tdata.busyProfiles = $scope.tdata.busyProfiles.concat($scope.allUrls[i].profiles.split(','));
          $scope.allUrlProfiles[$scope.allUrls[i].id] = $scope.allUrls[i];
          $scope.allUrlProfiles[$scope.allUrls[i].id].profiles = $scope.allUrlProfiles[$scope.allUrls[i].id].profiles.split(',');
        }
        $scope.tdata.dataLoaded = true;
        if(!$scope.$$phase) {
          $scope.$apply();
        }
        $scope.view.changeRoute = false;
      }, function (err) {
        $scope.view.changeRoute = false;
        console.log(err);
      });
    };

    $scope.getAllProfiles = function () {
      $scope.view.changeRoute = true;
      ProfileService.allProfiles().then(function (res) {
        $scope.tdata.allProfiles = res.data;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.openModal = function() {
      $scope.newUrl = {
        url: '',
        profiles: [],
        only_queues: false
      };
      $scope.getAllProfiles();
      $scope.getParamUrls();
    };

    $scope.clipboardCopied = function(id) {
      if (!$scope.tdata.popoverInit) {
        $('[data-toggle=popover]').popovers()
          .on('hidden.bs.popover', function (e) {
            $(e.target).data('bs.popover').inState.click = false;
          });
        $scope.tdata.popoverInit = true;
      }
      $('#copy-clipboard-btn-' + id).popover('show');
      setTimeout(function () {
        $('#copy-clipboard-btn-' + id).popover('hide');
      }, 800);
    };

    $scope.$on( "$routeChangeSuccess", function(event, next, current) {
      if (next.templateUrl === 'views/apps/paramurl.html') {
        $scope.getAllProfiles();
        $scope.getParamUrls();
        if (!$scope.tdata.clipInit) {
          new ClipboardJS('.copy-clipboard-btn');
          $scope.tdata.clipInit = true;
        }
      }
    });

    $scope.$on('loginCompleted', function (event, args) {
      $scope.getAllProfiles();
      $scope.getParamUrls();
      if (!$scope.tdata.clipInit) {
        new ClipboardJS('.copy-clipboard-btn');
        $scope.tdata.clipInit = true;
      }
    });
  });
