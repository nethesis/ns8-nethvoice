'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.ConfigurationService
 * @description
 * # ConfigurationService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('ConfigurationService', function($q, RestService) {

    this.list = function (filtered) {
      return $q(function (resolve, reject) {
        RestService.get('/users/' + filtered).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deletePhysicalExtension = function (ext) {
      return $q(function (resolve, reject) {
        RestService.delete('/physicalextensions/' + ext).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getVoiceMail = function (extension) {
      return $q(function (resolve, reject) {
        RestService.get('/voicemails/' + extension).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createVoiceMail = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/voicemails', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getMobileExtension = function (username) {
      return $q(function (resolve, reject) {
        RestService.get('/mobiles/' + username).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createMobileExtension = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/mobiles', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getWebRTCExtension = function (mainextension) {
      return $q(function (resolve, reject) {
        RestService.get('/webrtc/' + mainextension).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createWebRTCExtension = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/webrtc', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteWebRTCExtension = function (mainextension) {
      return $q(function (resolve, reject) {
        RestService.delete('/webrtc/' + mainextension).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getEncryption = function (ext) {
      return $q(function (resolve, reject) {
        RestService.get('/extensions/' + ext + '/srtp').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.setEncryption = function (ext, enabled) {
      return $q(function (resolve, reject) {
        RestService.post('/extensions/' + ext + '/srtp/' + enabled).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.retrieveFinalInfo = function () {
      return $q(function (resolve, reject) {
        RestService.get('/final').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

  });