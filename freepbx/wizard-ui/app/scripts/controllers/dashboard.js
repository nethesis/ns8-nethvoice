'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:DashboardCtrl
 * @description
 * # DashboardCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('DashboardCtrl', function ($rootScope, $scope, $interval, DashboardService) {
    $scope.data = {
      users: {},
      extensions: {},
      trunks: {},
      selExten: {},
      updateInterval: undefined,
      userChangingPresenceUsername: undefined,
      userChangingPresenceName: undefined
    };
    $scope.usersNumber = [];
    $scope.trunksNumber = [];
    $scope.view.changeRoute = true;

    $scope.usersLimit = 20;
    $scope.trunksLimit = 20;

    $scope.scrollingUsersContainer = function (){
      if ($scope.usersNumber) {
        if ($scope.usersNumber.length > $scope.usersLimit) {
          $scope.usersLimit += $scope.SCROLLPLUS
        }
      }
    }

    $scope.scrollingTrunksContainer = function (){
      if ($scope.trunksNumber) {
        if ($scope.trunksNumber.length > $scope.trunksLimit) {
          $scope.trunksLimit += $scope.SCROLLPLUS
          }
        }
    }

    $scope.update = function () {
      $scope.getUsers();
      $scope.getExtensions();
      $scope.getTrunks();
    };
    $scope.getUsers = function (s) {
      DashboardService.getUsers().then(function (res) {
        $scope.data.users = res.data;
        $scope.usersNumber = Object.values($scope.data.users);
        if (!$scope.wizard.isWizard) {
          $scope.view.changeRoute = false;
        }
      }, function (err) {
        console.log(err);
      });
    };
    $scope.getExtensions = function (s) {
      DashboardService.getExtensions().then(function (res) {
        $scope.data.extensions = res.data;
      }, function (err) {
        console.log(err);
      });
    };
    $scope.getTrunks = function (s) {
      DashboardService.getTrunks().then(function (res) {
        $scope.data.trunks = res.data;
        $scope.trunksNumber = Object.values($scope.data.trunks);
      }, function (err) {
        console.log(err);
      });
    };
    $scope.showExtenDetails = function (e, u) {
      DashboardService.getExtension(e).then(function (res) {
        $scope.data.selExten = res.data;
        for (var i = 0; i < $scope.data.users[u].endpoints.extension.length; i++) {
          if ($scope.data.users[u].endpoints.extension[i].id === res.data.exten) {
            $scope.data.selExten.type = $scope.data.users[u].endpoints.extension[i].type;
          }
        }
        $('#extenDetailsModal').modal('show');
      }, function (err) {
        console.log(err);
      });
    };
    $scope.setPresenceOnline = function (username) {
      DashboardService.setPresenceOnline(username).then(function (res) {
        $('#presenceSetupConfirmation').modal('hide');
        $scope.update();
      }, function (err) {
        console.log(err);
        $('#presenceSetupConfirmation').modal('hide');
        $scope.update();
      });
    };
    $scope.showSetPresenceConfirmation = function (u) {
      $scope.data.userChangingPresenceUsername = u.username;
      $scope.data.userChangingPresenceName = u.name;
      $('#presenceSetupConfirmation').modal('show');
    };
    $scope.$on('$routeChangeStart', function() {
      $interval.cancel($scope.data.updateInterval);
    });
    $rootScope.$on('loginCompleted', function (event, args) {
      $scope.update();
    });
    $scope.data.updateInterval = $interval(function () {
      $scope.update();
    }, 15000);

    if ($scope.login) {
      $scope.update();
    }
    $scope.redirectOnMigrationStatus();
  });
