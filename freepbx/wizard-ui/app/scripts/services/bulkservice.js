'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.bulkservice
 * @description
 * # bulkservice
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('BulkService', function ($q, RestService) {

    this.allContexts = function () {
      return $q(function (resolve, reject) {
        RestService.get('/contexts').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getBulkInfo = function (ext) {
      return $q(function (resolve, reject) {
        RestService.get('/bulk/' + ext).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getDestinations = function () {
      return $q(function (resolve, reject) {
        RestService.get('/destinations').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.setBulkInfo = function (ext, obj) {
      return $q(function (resolve, reject) {
        RestService.post('/bulk/' + ext, obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

  });
