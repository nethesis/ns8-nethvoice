'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:AdminReportCtrl
 * @description
 * # AdminReportCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('AdminReportCtrl', function ($scope, $rootScope, $filter, UserService) {
    $scope.customConfig = customConfig;
    $scope.users = [];
    $scope.view.changeRoute = true;
    $scope.usersLimit = 20

    $scope.retrieveInfo = function () {
      UserService.retrieveFinalInfo().then(function (res) {
        $scope.users = res.data;
        $scope.view.changeRoute = false;
      }, function (err) {
        console.log(err);
      });
    };

    $rootScope.$on('scrollingContainerView', function () {
      if($scope.users){
        if ($scope.users.length > $scope.usersLimit) {
          $scope.usersLimit += $scope.SCROLLPLUS
        }
      }
    });

    $scope.retrieveInfo();
  });
