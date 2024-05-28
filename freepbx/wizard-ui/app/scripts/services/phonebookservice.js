'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.phonebookservice
 * @description
 * # phonebookservice
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('PhonebookService', function ($q, RestService) {

    this.readFields = function () {
      return $q(function (resolve, reject) {
        RestService.get('/phonebook/fields').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.testConnections = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/test', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.readColumns = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/getcolumns', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.createConfig = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/config', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.readConfig = function () {
      return $q(function (resolve, reject) {
        RestService.get('/phonebook/config').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.updateConfig = function (id, obj) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/config/' + id, obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.deleteConfig = function (id) {
      return $q(function (resolve, reject) {
        RestService.delete('/phonebook/config/' + id).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.syncNow = function (id) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/syncnow/' + id).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.uploadFile = function (file) {
      return $q(function (resolve, reject) {
        RestService.postfile('/phonebook/uploadfile', file).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

  });