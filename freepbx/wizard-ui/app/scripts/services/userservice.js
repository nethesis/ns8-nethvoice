'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.UserService
 * @description
 * # UserService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('UserService', function ($q, RestService) {
    this.count = function () {
      return $q(function (resolve, reject) {
        RestService.get('/users/count').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.list = function (filtered) {
      return $q(function (resolve, reject) {
        RestService.get('/users/' + filtered).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.create = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/users', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.setPassword = function (username, obj) {
      return $q(function (resolve, reject) {
        RestService.post('/users/' + username + '/password', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getCsv = function () {
      return $q(function (resolve, reject) {
        RestService.get('/csv/csvexport').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.setCsvImport = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/csv/csvimport', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.statusCsvImport = function () {
      return $q(function (resolve, reject) {
        RestService.get('/csv/csvimport').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.createMainExtension = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/mainextensions', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createPhysicalExtension = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/physicalextensions', obj).then(function (res) {
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

    this.setPhoneModel = function (mac, model) {
      return $q(function (resolve, reject) {
        RestService.patch('/physicalextensions/' + mac, { "model": model }).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.getVoiceMail = function (extension) {
      return $q(function (resolve, reject) {
        RestService.get('/voicemails/' + extension).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getMobileNumber = function (username) {
      return $q(function (resolve, reject) {
        RestService.get('/mobiles/' + username).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createMobileNumber = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/mobiles', obj).then(function (res) {
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

    this.createMobileExtension = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/mobileapp', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getMobileExtension = function (mainextension) {
      return $q(function (resolve, reject) {
        RestService.get('/mobileapp/' + mainextension).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteMobileExtension = function (extension) {
      return $q(function (resolve, reject) {
        RestService.delete('/mobileapp/' + extension).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

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

    this.getNethLinkExtension = function (mainextension) {
      return $q(function (resolve, reject) {
        RestService.get('/nethlink/' + mainextension).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createNethLinkExtension = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/nethlink', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteNethLinkExtension = function (mainextension) {
      return $q(function (resolve, reject) {
        RestService.delete('/nethlink/' + mainextension).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

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
