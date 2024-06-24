'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.LoginService
 * @description
 * # LoginService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('LoginService', function($q, LocalStorageService, RestService, RestServiceCTI) {

    this.removeCredentials = function() {
      return $q(function (resolve, reject) {
        LocalStorageService.remove('secretkey');
        RestService.get('/logout').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getCredentials = function() {
      return LocalStorageService.get('secretkey');
    };

    this.login = function(username, password, secret) {
      return $q(function(resolve, reject) {
        if(secret === undefined) {
          var hash = RestService.getHash(username, password);
          RestService.setAuthHeader(username, hash);
          RestServiceCTI.setAuthHeader(username, hash);
        } else {
           RestService.setAuthHeader(secret.user, secret.hash);
           RestServiceCTI.setAuthHeader(secret.user, secret.hash);
        }
        RestService.get('/login').then(function(res) {
          res.hash = hash;
          resolve(res);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.logout = function(token) {
      return $q(function(resolve, reject) {
        User.logout({
          access_token: token,
        }, function(data) {
          $securityService.reset();
          resolve(data);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.getCurrentLoggeduser = function() {
      return LocalStorageService.get('currentLoggedUser');
    };
  });
