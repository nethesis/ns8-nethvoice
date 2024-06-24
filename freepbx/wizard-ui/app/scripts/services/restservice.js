'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.RestService
 * @description
 * # RestService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('RestService', function($q, $http, LocalStorageService) {

    this.setAuthHeader = function(user, hash) {
      $http.defaults.headers.common.User = user;
      $http.defaults.headers.common.Secretkey = hash;
      LocalStorageService.set('secretkey', { user: user, hash: hash.toString() });
    };

    this.getHash = function(username, password) {
      var pwdHash = CryptoJS.SHA1(password);
      var hash = CryptoJS.SHA1(username + pwdHash + customConfig.SECRET_KEY);
      return hash;
    };

    this.tget = function(endpoint) {
      return $q(function(resolve, reject) {
        $http.get(endpoint).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.tpatch = function(endpoint, data) {
      return $q(function(resolve, reject) {
        $http.patch(endpoint, data).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.tpost = function(endpoint, data) {
      return $q(function(resolve, reject) {
        $http.post(endpoint, data).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.tdelete = function(endpoint, data) {
      return $q(function(resolve, reject) {
        if (data) {
          $http.delete(endpoint, { data: data }).then(function successCallback(response) {
            resolve(response);
          }, function errorCallback(response) {
            reject(response);
          });
        } else {
          $http.delete(endpoint).then(function successCallback(response) {
            resolve(response);
          }, function errorCallback(response) {
            reject(response);
          });
        }
      });
    };

    this.tupload = function (endpoint, file, progressCallback) {
      let formdata = new FormData();
      formdata.append(0, file)
      let req = {
        method: 'POST',
        url: endpoint,
        headers: {
          'Content-Type': undefined
        },
        data: formdata
        // Needs angularjs upgrade
        // uploadEventHandlers: {
        //   progress: function(e) {
        //     console.log(e)
        //     if (e.lengthComputable) {
        //         progress = Math.round(e.loaded * 100 / e.total)
        //         progressCallback(progress)
        //     }
        //   }
        // }
      }
      return $q(function(resolve, reject) {
        $http(req).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    }

    this.get = function(endpoint) {
      return $q(function(resolve, reject) {
        $http.get(customConfig.BASE_API_URL + endpoint).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.post = function(endpoint, data) {
      return $q(function(resolve, reject) {
        $http.post(customConfig.BASE_API_URL + endpoint, data).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.postfile = function (endpoint, file) {
      let formdata = new FormData();
      formdata.append(0, file)
      let req = {
        method: 'POST',
        url: customConfig.BASE_API_URL + endpoint,
        headers: {
          'Content-Type': undefined
        },
        data: formdata
      }
      return $q(function (resolve, reject) {
        $http(req).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    }

    this.patch = function(endpoint, data) {
      return $q(function(resolve, reject) {
        $http.patch(customConfig.BASE_API_URL + endpoint, data).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.put = function(endpoint, data) {
      return $q(function(resolve, reject) {
        $http.put(customConfig.BASE_API_URL + endpoint, data).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

    this.delete = function(endpoint, data) {
      return $q(function(resolve, reject) {
        if (data) {
          $http.delete(customConfig.BASE_API_URL + endpoint, { data: data }).then(function successCallback(response) {
            resolve(response);
          }, function errorCallback(response) {
            reject(response);
          });
        } else {
          $http.delete(customConfig.BASE_API_URL + endpoint).then(function successCallback(response) {
            resolve(response);
          }, function errorCallback(response) {
            reject(response);
          });
        }
      });
    };

    this.deleteWithContentTypeJson = function(endpoint, data) {
      var req = {
        method: 'DELETE',
        url: customConfig.BASE_API_URL + endpoint,
        headers: {
          'Content-Type': 'application/json;charset=utf-8'
        },
        data: data
       }
      return $q(function(resolve, reject) {
        $http(req).then(function successCallback(response) {
          resolve(response);
        }, function errorCallback(response) {
          reject(response);
        });
      });
    };

  });