'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.TrunkService
 * @description
 * # TrunkService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('TrunkService', function ($q, RestService) {

    this.count = function () {
      return $q(function (resolve, reject) {
        RestService.get('/trunks/count').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getAllTrunks = function () {
      return $q(function (resolve, reject) {
        RestService.get('/trunks').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    /**
     * HTTP get request to retrieve sip trunks.
     *
     * @method getSipTrunks
     */
    this.getSipByTech = function (tech) {
      return $q(function (resolve, reject) {
        RestService.get('/trunks/' + tech).then(function (res) {
          resolve(res.data);
        }, function (err) {
          reject(err);
        });
      });
    };

    /**
     * HTTP get request to retrieve providers.
     *
     * @method getProviders
     */
    this.getProviders = function () {
      return $q(function (resolve, reject) {
        RestService.get('/providers').then(function (res) {
          resolve(res.data);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createTrunkVoip = function (trunk) {
      return $q(function (resolve, reject) {
        RestService.post('/trunks', {
          provider: trunk.provider,
          name: trunk.name,
          username: trunk.username,
          password: trunk.password,
          phone: trunk.phone,
          codecs: trunk.codecs,
          forceCodec: trunk.forceCodec
        }).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.changeTrunkPwd = function (trunkid, obj) {
      return $q(function (resolve, reject) {
        RestService.patch('/trunks/' + trunkid, obj).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.deleteTrunk = function (trunkid) {
      return $q(function (resolve, reject) {
        RestService.delete('/trunks/' + trunkid).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

  });
