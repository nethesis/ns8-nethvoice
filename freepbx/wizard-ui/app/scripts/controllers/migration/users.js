'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:UsersmigrationCtrl
 * @description
 * # UsersmigrationCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('UsersmigrationCtrl', function ($scope, $rootScope, $location, $interval, UserService, UtilService, MigrationService) {
    
    $scope.migration = {
      oldUserToRemove : '',
      newUserForKey : '',
      profiles : {
        statusDone: false,
        started: false,
        loading: false,
        completed: false,
        status: 'todo',
        data: {}
      },
      users: {
        statusDone: false,
        started: false,
        loading: false,
        completed: false,
        status: 'todo',
        data: {}
      }
    };

    $scope.olduserLimit = 20;
    $scope.userLimit = 20;
    $scope.totalUsers = 0;
    $scope.usersTranfered = 0;

    $scope.errorUserCreation = false;

    $scope.temp = {
      errorCount: 0,
      currentProgress: 0
    };

    $scope.users = {};
    $scope.taskPromise = null;
    $scope.onSave = false;
    $scope.lockOnList = false;

    $scope.openSelect = function (id) {
        $("#" + id).addClass('open');
    }

    $scope.removeOldExtension = function () {
      $scope.oldusers.splice($scope.oldUserToRemove, 1);
      $('#confirmDelete').modal('hide');
      $scope.oldUserToRemove = '';
      $scope.reloadAvaibleUsers();
    } 

    $scope.showConfMigAlert = function () {
      $("#alertStartConfMig").modal("show");
    }

    $scope.startConfigMig = function () {
      $("#alertStartConfMig").modal('hide');
      $location.path('/migration/config');
    }

    $scope.checkRemoveOldExtension = function (key) {
      $scope.oldUserToRemove = key;
    }

    $scope.createUser = function (user) {
      var username = user.username;
      var fullname = user.fullname;
      $scope.errorUserCreation = false;
      $scope.onSave = true;
      for (var olduser in $scope.oldusers) {
        if ($scope.oldusers[olduser].username === user.username) {
          $scope.onSave = false;
          $scope.errorUserCreation = true;
          return;
        }
      }
      UserService.create(user).then(function (res) {
        UserService.setPassword(user.username, {
          password: UtilService.randomPassword(8)
        }).then(function (res) {
          $scope.onSave = false;
          $('#createUser').modal('hide');
          $scope.oldusers[$scope.migration.newUserForKey].username = username;
          $scope.oldusers[$scope.migration.newUserForKey].name = fullname;
          $scope.getUsersList();
          $scope.newUser = {};
          $scope.migration.newUserForKey = "";
        }, function (err) {
          $scope.onSave = false;
          console.log(err);
        });
      }, function (err) {
        $scope.onSave = false;
        console.log(err);
      });
    };

    $scope.associateUser = function (olduser, user, id) {
      olduser.username = user.username;
      olduser.name = user.displayname;
      $scope.openSelect("selectId" + olduser.extension);
      $scope.reloadAvaibleUsers();
    }

    $scope.disassociatesUser = function (olduser) {
      olduser.username = '';
      olduser.name = olduser.oldname;
      $scope.reloadAvaibleUsers();
    }

    $scope.setNewUserFor = function (key) {
      $scope.migration.newUserForKey = key;
    }

    $scope.reloadAvaibleUsers = function () {
      for (var user in $scope.users) {
        for (var olduser in $scope.oldusers) {
          if ($scope.oldusers[olduser].username === $scope.users[user].username) {
            $scope.users[user].inuse = true;
            break;
          } else {
            $scope.users[user].inuse = false;
          }
        }
      }
    }

    $scope.areUsersAvaible = function () {
      for (var user in $scope.users) {
        if ($scope.users[user].inuse === false) {
          return true;
        }
      }
      return false;
    }

    $scope.resetUsersMig = function () {
      $scope.migration.users.completed = false;
      $scope.migration.users.status = "todo";
    }

    $scope.resetUser = function (olduser) {
      olduser.username = olduser.oldusername;
      olduser.name = olduser.oldname;
      $scope.reloadAvaibleUsers();
    }

    $scope.startProfilesMig = function () {
      $scope.migration.profiles.loading = true;
      $scope.migration.profiles.started = true;
      MigrationService.importProfiles().then(function (res) {
        $scope.slideDown("collapse-profilemig");
        $scope.slideDown("collapse-usermig");
        $scope.migration.profiles.loading = false;
        $scope.migration.profiles.data = res.data;
        $scope.migration.profiles.status = "success";
      }, function (err) {
        $scope.slideDown("collapse-profilemig");
        $scope.slideDown("collapse-usermig");
        $scope.migration.profiles.loading = false;
        $scope.migration.profiles.data = err.data;
        $scope.migration.profiles.status = "fail";
        console.log(err);
      });
    }

    $scope.startUsersMig = function () {
      $scope.migration.users.loading = true;
      $scope.toggleMig("collapse-usermig");
      MigrationService.importUsers($scope.oldusers).then(function (res) {
        $scope.importConfirm();
      }, function (err) {
        console.log(err);
        $scope.slideDown("collapse-usermig");
        $scope.migration.users.loading = false;
        $scope.migration.users.status = "fail";
      });
    }

    $scope.failUserMig = function (err) {
      $scope.migration.users.data = err.data;
      $scope.slideDown("collapse-usermig");
      $scope.slideUp("collapse-profilemig");
      $scope.migration.users.loading = false;
      $scope.migration.users.status = "fail";
      $scope.importError();
    }

    $scope.importError = function () {
      $scope.temp.loadingCancel = false;
      $interval.cancel($scope.taskPromise);
      $scope.getUsersList();
      $scope.temp.currentProgress = -1;
    }

    $scope.clearImport = function () {
      $scope.temp.errorCount = 0;
      $scope.temp.currentProgress = 0;
      $scope.temp.loading = false;
      $scope.temp.loadingCancel = false;
    }

    $scope.hideUserMigModal = function () {
      setTimeout(function () {
        $('#importModalMig').modal('hide');
        $scope.temp.errorCount = 0;
        $scope.temp.currentProgress = 0;
        $scope.temp.loading = false;
        $scope.temp.loadingCancel = false;
      }, 1000);
    }

    $scope.importConfirm = function () {
      $scope.temp.loading = true;
      $scope.temp.loadingCancel = true;
      $scope.migration.users.started = true;
      $scope.taskPromise = $interval(function () {
        UserService.statusCsvImport().then(function (res) {
          if (res.data.result < 100 && res.data.result != null) {
            $scope.temp.errorCount = 0;
            $scope.temp.currentProgress = res.data.result;
          } else if (res.data.result == 100) {
            $interval.cancel($scope.taskPromise);
            $scope.temp.errorCount = 0;
            $scope.temp.currentProgress = 100;
            $scope.migration.users.data = res.data;
            $scope.migration.users.loading = false;
            $scope.migration.users.status = "success";
            $scope.toggleMig("collapse-usermig");
            $scope.getUsersList();
            $scope.hideUserMigModal();
          } else {
            $scope.failUserMig(res);
            $scope.hideUserMigModal();
            console.log(res.error);
          }
        }, function (err) {
          $scope.failUserMig(err);
          $scope.hideUserMigModal();
          console.log(err);
        });
      }, 5000);
    }

    $scope.getUsersList = function () {
      if (!$scope.lockOnList) {
        $scope.lockOnList = true;
        UserService.list(true).then(function (res) {
          $scope.users = res.data;
          $scope.lockOnList = false;
          $scope.reloadAvaibleUsers();
          $scope.countUser($scope.users);
          setTimeout(function () {
            $scope.$apply();
          }, 100);
        }, function (err) {
          $scope.users = {}
          $scope.lockOnList = false;
          console.log(err);
        });
      }
    };

    $scope.countUser = function(user){
      $scope.counting = 0;
      for (var counting in user ){
        $scope.counting = $scope.counting + 1;
      }
      $scope.usersTranfered = $scope.counting;
    }

    $scope.getOldUsers = function () {
      MigrationService.getOldUsers().then(function (res) {
        $scope.view.changeRoute = false;
        $scope.oldusers = res.data;
        for (var olduser in $scope.oldusers) {
          if ($scope.oldusers[olduser].name !== '') {
            $scope.oldusers[olduser].oldname = $scope.oldusers[olduser].name;
          }
          if ($scope.oldusers[olduser].username !== '') {
            $scope.oldusers[olduser].oldusername = $scope.oldusers[olduser].username;
          }
        }
        $scope.countOldUser($scope.oldusers);
        $scope.getUsersList();
      }, function (err) {
        $scope.view.changeRoute = false;
        console.log(err);
      });
    }

    $scope.countOldUser = function(old){
      $scope.count = 0;
      for (var count in old ){
        $scope.count = $scope.count + 1;
      }
      $scope.totalUsers = $scope.count;
    }

    $rootScope.$on('scrollingContainerView', function () {
      if($scope.totalUsers){
        if ($scope.totalUsers > $scope.olduserLimit) {
          $scope.olduserLimit += $scope.SCROLLPLUS
        }
      }
      if($scope.usersTranfered){
        if ($scope.usersTranfered > $scope.userLimit) {
          $scope.userLimit += $scope.SCROLLPLUS
        }
      }
    });

    $scope.validateMigrationStatus = function () {
      MigrationService.getMigrationStatus().then(function (res) {
        if (res.data == "ready" && $scope.wizard.fromMigrationStart) {
          $scope.startProfilesMig();
        } else if (res.data === "profiles") {
          $scope.migration.profiles.statusDone = true;
          $scope.slideDown("collapse-usermig");
        } else if (res.data === "users") {
          $scope.migration.profiles.statusDone = true;
          $scope.migration.users.statusDone = true;
        } else {
          $scope.redirectOnMigrationStatus(res.data);
        }
      }, function (err) {
        console.log(err);
      });
    }

    $scope.validateMigrationStatus();
    $scope.getOldUsers();

  });
