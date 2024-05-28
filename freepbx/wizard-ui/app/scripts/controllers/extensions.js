'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:UsersExtensionsCtrl
 * @description
 * #UsersExtensionsCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('UsersExtensionsCtrl', function ($scope, $rootScope, $location, $interval, ConfigService, UserService, UtilService) {
    $scope.users = {};
    $scope.providerLocal = false;
    $scope.taskPromise = null;
    $scope.onSave = false;
    $scope.lockOnList = false;
    $scope.availableUsersFilters = ['all', 'configured', 'unconfigured'];
    $scope.availableUserFiltersNumbers = ['username', 'displayname', 'default_extension', 'lname'];
    $scope.selectedUsersFilter = $scope.availableUsersFilters[0];
    $scope.usersFilterNumbers = $scope.availableUserFiltersNumbers[0];
    $scope.usersFilterNumbersOrd = false;
    $scope.view.changeRoute = true;
    $scope.usersLimit = 20
    $scope.localDomain = "";

    $scope.error = {
      file: {
        status: false,
        title: 'File format error',
        content: 'File must be a CSV'
      }
    };

    $scope.temp = {
      errorCount: 0,
      currentProgress: 0
    };

    $rootScope.$on('scrollingContainerView', function () {
      if($scope.users){
        if ($scope.users.length > $scope.usersLimit) {
          $scope.usersLimit += $scope.SCROLLPLUS
        }
      }
    });

    $scope.checkDefaultExtensions = function() {
      $scope.wizard.nextState = false;
      for (var u in $scope.users) {
        if ($scope.users[u].default_extension != "none") {
          $scope.wizard.nextState = true;
        }
      }
    }

    $scope.checkUserProviderStatus = function () {
      ConfigService.getConfig().then(function (res) {
        $scope.view.changeRoute = false;
        $scope.localDomain = res.data.domain;
        if (res.data.configured === 0) {
          $scope.showConfigSwitch = true;
          $location.path('/users');
        } else {
          if (res.data.local === 1) {
            $scope.providerLocal = true;
          } else {
            $scope.providerLocal = true;
          }
          if (res.data.type === 'ldap') {
            $scope.mode.isLdap = true;
          } else {
            $scope.mode.isLdap = false;
          }
        }
      }, function (err) {
        $scope.view.changeRoute = false;
        console.log(err);
      });
    }

    $scope.getUserList = function () {
      if (!$scope.lockOnList) {
        $scope.lockOnList = true;
        UserService.list(true).then(function (res) {
          $scope.users = res.data;
          $scope.checkUserProviderStatus();
          if (UtilService.isEmpty($scope.users)) {
            $scope.wizard.nextState = false;
          } else {
            $scope.checkDefaultExtensions();
          }
          $scope.lockOnList = false;
        }, function (err) {
          $scope.users = {}
          $scope.view.changeRoute = false;
          $scope.lockOnList = false;
          console.log(err);
        });
      }
    };

    $scope.createUser = function (user) {
      $scope.onSave = true;
      UserService.create(user).then(function (res) {
        UserService.setPassword(user.username, {
          password: UtilService.randomPassword(8)
        }).then(function (res) {
          $scope.onSave = false;
          $('#createUser').modal('hide');
          $scope.newUser = {};
          $scope.getUserList();
        }, function (err) {
          $scope.onSave = false;
          console.log(err);
        });
      }, function (err) {
        $scope.onSave = false;
        console.log(err);
      });
    };

    $scope.setMainExtension = function (user) {
      user.isInAction = true;
      user.alreadyExists = false;
      UserService.createMainExtension({
        username: user.username,
        extension: user.default_extension !== 'none' ? user.default_extension : user.temp_ext
      }).then(function (res) {
        user.isInAction = false;
        if (user.temp_ext && user.temp_ext.length == 0 && user.default_extension == 'none' || user.default_extension.length == 0) {
          user.default_extension = 'none';
          $scope.checkDefaultExtensions();
        } else {
          user.default_extension = user.default_extension !== 'none' ? user.default_extension : user.temp_ext;
          $scope.wizard.nextState = true;
        }
      }, function (err) {
        user.isInAction = false;
        if (err.status == 422) {
          user.alreadyExists = true;
        }
        console.log(err);
      });
    }

    $scope.csvExport = function () {
      UserService.getCsv().then(function (res) {
        var dlnk = document.getElementById('dlLink');
        dlnk.href = 'data:application/octet-stream;base64,' + res.data;
        dlnk.click();
      }, function (err) {
        console.log(err);
      });
    }

    $scope.fileSelectImport = function () {
      $('#importInput').click();
      $('#importInput').change(function(e) {
        if (e.target.files[0].name != undefined) {
          $scope.temp.csvFileName = e.target.files[0].name;
          var reader = new FileReader();
          reader.onload = function(ev) {
            $scope.$apply(function() {
              $scope.temp.file64 = ev.target.result;
              $scope.error.file.status = false;
              $('#importInput').val('');
              $('#importInput').unbind();
            });
          };
          reader.readAsDataURL(e.target.files[0]);
          $('#importModal').modal('show');
        } else {
          $scope.$apply(function() {
            $scope.error.file.status = true;
          });
        }
      });
    }

    $scope.importError = function () {
      $scope.temp.loadingCancel = false;
      $interval.cancel($scope.taskPromise);
      $scope.getUserList();
      $scope.temp.currentProgress = -1;
    }

    $scope.importConfirm = function (f) {
      $scope.temp.loading = true;
      $scope.temp.loadingCancel = true;
      UserService.setCsvImport({'file':f}).then(function (res) {
        $scope.taskPromise = $interval(function () {
          UserService.statusCsvImport(res.data.result).then(function (res) {
            if (res.data.result < 100 && res.data.result != null) {
              $scope.temp.errorCount = 0;
              $scope.temp.currentProgress = res.data.result;
            } else if (res.data.result == 100) {
              $interval.cancel($scope.taskPromise);
              $scope.temp.errorCount = 0;
              $scope.temp.currentProgress = 100;
              $scope.getUserList();
              setTimeout(function () {
                $('#importModal').modal('hide');
                $scope.temp.errorCount = 0;
                $scope.temp.currentProgress = 0;
                $scope.temp.loading = false;
                $scope.temp.loadingCancel = false;
              },1000);
            } else {
              console.log(res.error);
              $scope.importError();
            }
          }, function (err) {
            console.log(err);
            $scope.importError();
          });
        }, 5000);
      }, function (err) {
        console.log(err);
        $scope.importError();
      });
    }

    $scope.clearImport = function () {
      $scope.temp.errorCount = 0;
      $scope.temp.currentProgress = 0;
      $scope.temp.loading = false;
      $scope.temp.loadingCancel = false;
    }

    $scope.$on('$destroy', function () {
      $interval.cancel($scope.taskPromise);
    });

    $scope.getUserList();
  });
