'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:TrunksPhysicalCtrl
 * @description
 * # TrunksPhysicalCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('TrunksPhysicalCtrl', function ($scope, $rootScope, $location, $interval, UserService, TrunkService, ConfigService, UtilService, DeviceService) {

    $scope.allDevices = {};
    $scope.allVendors = {};
    $scope.allModels = {};
    $scope.sipTrunks = {};
    $scope.selectedDevice = {};
    $scope.newGateway = {};
    $scope.onSave = false;
    $scope.users = [];
    $scope.physicalLimit = {};
    $scope.exampleInputProxy = ''
    $scope.exampleIpv4_green = ''
    $scope.stringToCheckGrandstream = "grandstream";
    var limitLength = 20;

    $scope.getUserList = function () {
      UserService.list(false).then(function (res) {
        $scope.users = res.data;
        var index = 0;
        for (var u in $scope.users) {
          if ($scope.users[u].default_extension !== 'none') {
            index = u;
            break;
          } else {
            continue;
          }
        }
      }, function (err) {
        console.log(err);
      });
    };

    $scope.selectDevice = function (device, network, networkName) {
      device.network_name = networkName
      if (device.isConnected) {
        device.ipv4_new = device.ipv4;
      } else {
        device.ipv4 = device.ipv4_new;
      }
      $scope.selectedDevice = device;
      if (!device.isConfigured) {
        $scope.selectedDevice.netmask_green = network.netmask;
        $scope.selectedDevice.gateway = network.gateway;
        $scope.selectedDevice.ipv4_green = network.ip;
      }
      $scope.selectedDevice.isGrandstream = ( $scope.selectedDevice.manufacturer && $scope.selectedDevice.manufacturer.toLowerCase() === $scope.stringToCheckGrandstream );
    };

    $scope.close = function (device) {
      device.onSave = false;
      device.onSaveSuccess = false;
      device.onError = false;
      device.onDeleteSuccess = false;
      device.onPushSuccess = false;
    };

    $scope.getModelDescription = function (device) {
      if (device && device.manufacturer && device.model) {
        var obj = $scope.allModels[device.manufacturer].filter(function (obj) {
          if (obj.id == device.model) {
            return obj;
          }
        })[0];
        return obj && obj.model && obj.description ? {
          description: obj.description,
          model: obj.model
        } : '';
      } else {
        return {
          description: ''
        };
      }
    };

    $scope.getGatewayModelList = function () {
      DeviceService.gatewayModelList().then(function (res) {
        $scope.allModels = res.data;
        $scope.allVendors = Object.keys($scope.allModels);
        var firstModel = Object.values($scope.allModels)[0][0];
        $scope.exampleInputProxy = firstModel.proxy;
        $scope.exampleIpv4_green = firstModel.ipv4_green;
        $scope.newGateway.proxy = $scope.exampleInputProxy;
        $scope.newGateway.ipv4_green = $scope.exampleIpv4_green;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getNetworkList = function (reload) {
      $scope.view.changeRoute = reload;
      $scope.getGatewayList('eth-fake', 'fake-network');
      $scope.view.changeRoute = false;
    };

    $scope.getGatewayList = function (key, network) {
      DeviceService.gatewayListByNetwork(network).then(function (res) {
        $scope.allDevices[key] = res.data;
        $scope.pushKey(key);
        $scope.selectedDevice = res.data[0];
        $scope.onSave = false;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.pushKey = function (network){
      if (network) {
        $scope.physicalLimit[network] = limitLength;
      }
    }

    $scope.scrollingPhysicalContainer = function (networkName) {
      if ($scope.allDevices[networkName].length > $scope.physicalLimit[networkName]) {
        $scope.physicalLimit[networkName] += $scope.SCROLLPLUS
      }
    }

    $scope.updateExtraFields = function (device) {
      var tempArr = $scope.allModels[device.manufacturer];
      var base_num = device.manufacturer === 'Patton' ? 0 : 1;
      for (var i = 0; i < tempArr.length; i++) {
        if (tempArr[i].id === device.model) {
          // add isdn trunk fields
          device.trunks_isdn = [];
          for (var k = 0; k < tempArr[i].n_isdn_trunks; k++) {
            device.trunks_isdn.push({
              name: k + base_num,
              type: 'pp'
            });
          }
          // add pri trunk fields
          device.trunks_pri = [];
          for (var k = 0; k < tempArr[i].n_pri_trunks; k++) {
            device.trunks_pri.push({
              name: k + base_num
            });
          }
          // add fxo trunk fields
          device.trunks_fxo = [];
          for (var k = 0; k < tempArr[i].n_fxo_trunks; k++) {
            device.trunks_fxo.push({
              name: k + base_num,
              number: '',
            });
          }
          // add fxs ext fields
          device.trunks_fxs = [];
          for (var k = 0; k < tempArr[i].n_fxs_ext; k++) {
            device.trunks_fxs.push({
              name: k + base_num,
              linked_extension: ''
            });
          }
        }
      }
      device.name = device.manufacturer + '-' + $scope.getModelDescription(device, true).description;
    };

    $scope.setNewGateway = function (network_key, network) {
      $scope.newGateway.network_key = network_key;
      $scope.newGateway.network = network.network;
      $scope.newGateway.ipv4_new = network.network.slice(0, -1);
      $scope.newGateway.ipv4_green = network.ip;
      $scope.newGateway.gateway = network.gateway;
      $scope.newGateway.netmask_green = network.netmask;
    };

    $scope.hideGatewayDialog = function () {
      $scope.newGateway = {};
      $scope.newGateway.proxy = $scope.exampleInputProxy;
      $scope.newGateway.ipv4_green = $scope.exampleIpv4_green;
      $('#newGwDialog').modal('hide');
    };

    $scope.saveConfig = function (device, isNew) {
      device.onSave = true;
      device.onSaveSuccess = false;
      device.onError = false;
      device.onDeleteSuccess = false;
      device.onPushSuccess = false;
      if (isNew) {
        device.ipv4 = '';
      }
      DeviceService.saveGatewayConfig(device).then(function (res) {
        $scope.hideGatewayDialog();
        $scope.getGatewayList('eth-fake', 'fake-network');
        device.id = res.data.id
        if (isNew) {
          $scope.allDevices[device.network_key].push(device);
        }
        device.ipv4 = device.ipv4_new;
        device.isConfigured = true;
        device.onSave = false;
        if (!isNew) {
          device.onSaveSuccess = true;
        }
        device.onError = false;
        device.onDeleteSuccess = false;
        device.onPushSuccess = false;
        //trunks
        TrunkService.count().then(function (res) {
          $scope.menuCount.trunks = res.data;
        }, function (err) {
          console.log(err);
        });
      }, function (err) {
        device.onSave = false;
        device.onSaveSuccess = false;
        device.onError = true;
        device.onDeleteSuccess = false;
        device.onPushSuccess = false;
        console.log(err);
      });
    };

    $scope.pushConfig = function (device) {
      device.onSave = true;
      DeviceService.pushGatewayConfig({
        name: device.name,
        ipv4_green: '',
        netmask_green: '',
        mac: device.mac
      }).then(function (res) {
        device.onSave = false;
        device.onSaveSuccess = false;
        device.onError = false;
        device.onDeleteSuccess = false;
        device.onPushSuccess = true;
      }, function (err) {
        console.log(err);
        device.onSave = false;
        device.onSaveSuccess = false;
        device.onError = true;
        device.onDeleteSuccess = false;
        device.onPushSuccess = false;
      });
    };

    $scope.downConfig = function (device) {
      device.onSave = true;
      DeviceService.downloadConfig(device.name, device.mac).then(function (res) {
        var link = document.getElementById('dlLink');
        var data = atob(res.data);
        var config = new Blob([data], { type: 'application/octet-stream;charset=utf-8;' });
        var url = URL.createObjectURL(config);
        link.setAttribute('href', url);
        //check if the manufacturer is Grandstream
        //If the device is a Grandstream, the file format will be the device name + ".xml"
        //else will be the device name + ".cfg"
        link.setAttribute("download", device.isGrandstream ? device.name.match(/^\S+/)[0] + ".xml" : device.name.match(/^\S+/)[0] + ".cfg");
        link.click();
        device.onSave = false;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.deleteConfig = function (device) {
      device.onSave = true;
      DeviceService.deleteGatewayConfig(device.id).then(function (res) {
        device.onSave = false;
        device.onSaveSuccess = false;
        device.onError = false;
        device.onDeleteSuccess = true;
        device.onPushSuccess = false;
        $scope.selectedDevice = {};
        $scope.getGatewayList('eth-fake', 'fake-network');
        //trunks
        TrunkService.count().then(function (res) {
          $scope.menuCount.trunks = res.data;
        }, function (err) {
          console.log(err);
        });
      }, function (err) {
        console.log(err);
        device.onSave = false;
        device.onSaveSuccess = false;
        device.onError = true;
        device.onDeleteSuccess = false;
        device.onPushSuccess = false;
      });
    };

    $scope.getNetworkList(true);
    $scope.getGatewayModelList();
    $scope.getUserList();

  });
