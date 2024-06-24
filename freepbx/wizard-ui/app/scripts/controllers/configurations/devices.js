'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:UsersDevicesCtrl
 * @description
 * # UsersDevicesCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('UsersDevicesCtrl', function ($scope, $interval, ConfigService, DeviceService, UtilService) {
    $scope.allDevices = {};
    $scope.allModels = {};
    $scope.networks = {};
    $scope.networkLength = 0;
    $scope.scanned = false;

    $scope.orderByValue = function (value) {
      return value;
    };

    $scope.getPhoneModelList = function () {
      DeviceService.phoneModelList().then(function (res) {
        $scope.allModels = res.data;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getNetworkList = function (reload) {
      $scope.view.changeRoute = reload;
      ConfigService.getNetworks().then(function (res) {
        $scope.networks = res.data;
        for (var eth in res.data) {
          $scope.allDevices[eth] = {};
        }
        $scope.networkLength = Object.keys(res.data).length;
        $scope.view.changeRoute = false;
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    };

    $scope.getPhoneList = function (key, network, callback) {
      DeviceService.phoneListByNetwork(network).then(function (res) {
        $scope.allDevices[key] = res.data;
        $scope.scanned = true;
        callback(null);
      }, function (err) {
        if (err.status !== 404) {
        } else {
        }
        callback(err);
      });
    };

    $scope.startScan = function (key, network) {
      DeviceService.startScan(network).then(function (res) {
        $scope.getPhoneList(key, network, function (err) {
          if (err) {
            console.log(err);
          }
        });
      }, function (err) {
        console.log(err);
      });
    };

    $scope.setPhoneModel = function (device) {
      DeviceService.setPhoneModel({
        mac: device.mac,
        vendor: device.manufacturer,
        model: device.model
      }).then(function (res) {}, function (err) {
        console.log(err);
      });
    };

    $scope.getNetworkList(true);
    $scope.getPhoneModelList();
  });
