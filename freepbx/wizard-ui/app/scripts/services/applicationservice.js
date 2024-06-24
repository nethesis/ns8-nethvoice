'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.ApplicationService
 * @description
 * # ApplicationService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('ApplicationService', function ($q, $http, RestService, RestServiceCTI) {

    this.allExtensions = function () {
      return $q(function (resolve, reject) {
        RestService.get('/physicalextensions').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.allSources = function () {
      return $q(function (resolve, reject) {
        RestService.get('/cti/dbconn').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.allVideoSources = function () {
      return $q(function (resolve, reject) {
        RestService.get('/cti/streaming').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getParamUrls = function () {
      return $q(function (resolve, reject) {
        RestService.get('/cti/paramurls').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.allTemplates = function () {
      return $q(function (resolve, reject) {
        RestService.get('/cti/customer_card/template').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.allCards = function () {
      return $q(function (resolve, reject) {
        RestService.get('/cti/customer_card').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.allDBTypes = function () {
      return $q(function (resolve, reject) {
        RestService.get('/cti/dbconn/type').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.sourceDeps = function (id) {
      return $q(function (resolve, reject) {
        RestService.get('/cti/customer_card?dbconn_id=' + id).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.templateDeps = function (name) {
      return $q(function (resolve, reject) {
        RestService.get('/cti/customer_card?template=' + name).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.checkConnectionSource = function (obj) {
      return $q(function (resolve, reject) {
        RestServiceCTI.post('/dbconn/test', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.checkConnectionVideoSource = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/cti/sources/test', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.customerCardPreview = function (obj) {
      return $q(function (resolve, reject) {
        RestServiceCTI.post('/custcard/preview', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createSource = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/cti/dbconn', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createVideoSource = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/cti/streaming', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createParamUrl = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/cti/paramurl', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.updateParamUrl = function (obj) {
      return $q(function (resolve, reject) {
        RestService.put('/cti/paramurl/' + obj.id, obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteParamUrl = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/cti/paramurl/delete', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.updateVideoSource = function (descr, obj) {
      return $q(function (resolve, reject) {
        RestService.put('/cti/streaming/' + descr, obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.updateSource = function (id, obj) {
      return $q(function (resolve, reject) {
        RestService.put('/cti/dbconn/' + id, obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteSource = function (id) {
      return $q(function (resolve, reject) {
        RestService.delete('/cti/dbconn/' + id).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteVideoSource = function (name) {
      return $q(function (resolve, reject) {
        RestService.delete('/cti/streaming/' + name).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createTemplate = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/cti/customer_card/template', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.updateTemplate = function (id, obj) {
      return $q(function (resolve, reject) {
        RestService.put('/cti/customer_card/template/' + id, obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteTemplate = function (name) {
      return $q(function (resolve, reject) {
        RestService.delete('/cti/customer_card/template/' + name).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createCard = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/cti/customer_card', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.updateCard = function (id, obj) {
      return $q(function (resolve, reject) {
        RestService.put('/cti/customer_card/' + id, obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteCard = function (id) {
      return $q(function (resolve, reject) {
        RestService.delete('/cti/customer_card/' + id).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };
  });
