'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.DashboardService
 * @description
 * # DashboardService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('DashboardService', function ($q, RestServiceCTI) {
    this.getUsers = function () {
      return $q(function (resolve, reject) {
        RestServiceCTI.get('/user/endpoints/all').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };
    this.setPresenceOnline = function (username) {
      return $q(function (resolve, reject) {
        RestServiceCTI.post('/user/presence', {
          username: username,
          status: 'online'
        }).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };
    this.getExtensions = function () {
      return $q(function (resolve, reject) {
        RestServiceCTI.get('/astproxy/extensions').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };
    this.getTrunks = function () {
      return $q(function (resolve, reject) {
        RestServiceCTI.get('/astproxy/trunks').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };
    this.getExtension = function (exten) {
      return $q(function (resolve, reject) {
        RestServiceCTI.get('/astproxy/extension/' + exten).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };
  });
