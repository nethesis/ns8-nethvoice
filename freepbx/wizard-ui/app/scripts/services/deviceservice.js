'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.DeviceService
 * @description
 * # DeviceService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('DeviceService', function ($q, RestService, UtilService) {

    this.phoneList = function () {
      return $q(function (resolve, reject) {
        RestService.get('/devices/phones/list').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.noLinkedDevices = function () {
      return $q(function (resolve, reject) {
        RestService.get('/physicalextensions').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.phoneListByNetwork = function (network) {
      return $q(function (resolve, reject) {
        RestService.get('/devices/phones/list/' + UtilService.hashNetwork(network)).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.gatewayList = function () {
      return $q(function (resolve, reject) {
        RestService.get('/devices/gateways/list').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.gatewayListByNetwork = function (network) {
      return $q(function (resolve, reject) {
        RestService.get('/devices/gateways/list/' + UtilService.hashNetwork(network)).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.phoneModelList = function () {
      return $q(function (resolve, reject) {
        RestService.get('/devices/phones/manufacturers').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.gatewayModelList = function () {
      return $q(function (resolve, reject) {
        RestService.get('/devices/gateways/manufacturers').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.startScan = function (network) {
      return $q(function (resolve, reject) {
        RestService.post('/devices/scan', {
          network: network.ip + '/' + UtilService.maskToCidr(network.netmask)
        }).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.setPhoneModel = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/devices/phones/model', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.rebootPhone = function(obj) {
      return $q(function (resolve, reject) {
        RestService.post('/devices/phones/reboot', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.generateDeviceConfig = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/devices/phones/provision', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.saveGatewayConfig = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/devices/gateways', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.pushGatewayConfig = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/devices/gateways/push', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteGatewayConfig = function (id) {
      return $q(function (resolve, reject) {
        RestService.delete('/devices/gateways/' + id).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.downloadConfig = function (name, mac) {
      return $q(function (resolve, reject) {
        RestService.get('/devices/gateways/download/' + name + (mac ? '/' + mac : '')).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

  });
