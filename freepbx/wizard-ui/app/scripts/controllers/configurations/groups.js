'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:UsersGroupsCtrl
 * @description
 * # UsersGroupsCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('UsersGroupsCtrl', function ($scope, ProfileService) {
    $scope.allGroups = [];

    $scope.getAllGroups = function (reload) {
      $scope.view.changeRoute = reload;
      ProfileService.allGroups().then(function (res) {
        $scope.allGroups = res.data;
        $scope.view.changeRoute = false;
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    };

    $scope.saveGroup = function (group) {
      group.onSave = true;
      ProfileService.createGroup(group).then(function (res) {
        group.onSave = false;
        group.id = res.data.id;
        $scope.getAllGroups(false);
        $scope.onSaveSuccess = true;
        $scope.onSaveError = false;
        $scope.allGroups.push(group);
        $scope.newGroup = {};
        $('#newGroupModal').modal('hide');
      }, function (err) {
        group.onSave = false;
        $scope.onSaveSuccess = false;
        $scope.onSaveError = true;
        $('#newGroupModal').modal('hide');
        console.log(err);
      });
    };

    $scope.deleteGroup = function (group) {
      group.onSave = true;
      ProfileService.deleteGroup(group.id).then(function (res) {
        group.onSave = false;
        $scope.getAllGroups(false);
      }, function (err) {
        group.onSave = false;
        console.log(err);
      });
    };

    $scope.getAllGroups(true);
  });
