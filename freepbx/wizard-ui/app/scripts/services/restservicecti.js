'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.RestServiceCTI
 * @description
 * # RestServiceCTI
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('RestServiceCTI', function ($q, $http, LocalStorageService) {

    this.setAuthHeader = function(user, hash) {
      $http.defaults.headers.common.User = user;
      $http.defaults.headers.common.Secretkey = hash;
      LocalStorageService.set('secretkey', { user: user, hash: hash.toString() });
    };

    this.get = function (endpoint) {
      return $q(function (resolve, reject) {
        $http.get(customConfig.BASE_API_URL_CTI + endpoint).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.post = function (endpoint, data) {
      return $q(function (resolve, reject) {
        $http.post(customConfig.BASE_API_URL_CTI + endpoint, data).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.put = function (endpoint, data) {
      return $q(function (resolve, reject) {
        $http.put(customConfig.BASE_API_URL_CTI + endpoint, data).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.delete = function (endpoint) {
      return $q(function (resolve, reject) {
        $http.delete(customConfig.BASE_API_URL_CTI + endpoint).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };
  });
