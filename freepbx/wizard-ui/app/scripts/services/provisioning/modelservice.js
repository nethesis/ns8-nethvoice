'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.ModelService
 * @description
 * # ModelService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('ModelService', function ($q, RestService) {

    this.createModel = function (model) {
      return $q(function (resolve, reject) {
        RestService.tpost('/tancredi/api/v1/models', model).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    // Post phone
    this.addPhone = function (obj) {
      RestService.tpost('/tancredi/api/v1/phones', obj).then(function (res) {
        resolve(res)
      }, function (err) {
        reject(err)
      })
    }

    this.getPhones = function () {
      RestService.tget('/tancredi/api/v1/phones').then(function (res) {
        resolve(res)
      }, function (err) {
        reject(err)
      })
    }

    // Post model
    this.addModel = function (obj) {
      RestService.tpost('/tancredi/api/v1/models', obj).then(function (res) {
        resolve(res)
      }, function (err) {
        reject(err)
      })
    }

    // Retrieve the complete (phone) models collection
    this.getModels = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/models').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // Retrieve all the used models
    this.getUsedModels = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/models?filter[used]').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // Retrieve model
    this.getModel = function (name) {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/models/' + name).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // Retrieve original
    this.getOriginal = function (name) {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/models/' + name + '/version/original').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // Update model
    this.patchModel = function (name, obj) {
      return $q(function (resolve, reject) {
        RestService.tpatch('/tancredi/api/v1/models/' + name, obj).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // Create model
    this.createModel = function (obj) {
      return $q(function (resolve, reject) {
        RestService.tpost('/tancredi/api/v1/models', obj).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // Delete model
    this.deleteModel = function (name) {
      return $q(function (resolve, reject) {
        RestService.tdelete('/tancredi/api/v1/models/' + name).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // Retrieve the default variable values
    this.getDefaults = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/defaults').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // Set the default variable values
    this.setDefaults = function (obj) {
      return $q(function (resolve, reject) {
        RestService.tpatch('/tancredi/api/v1/defaults', obj).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.checkConnectivity = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/provisioning/connectivitycheck', obj).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }
    
    this.ldapCheck = function () {
      return $q(function (resolve, reject) {
        RestService.get('/phonebook/ldap').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // update admin password of phone web interface
    this.updateAdminPw = obj => {
      return $q(function (resolve, reject) {
        RestService.post('/physicalextensions/adminpw', obj).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        });
      });
    };

    // firmware
    this.getFirmwares = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/firmware').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.uploadFirmware = function (file, progressCallback) {
      return $q(function (resolve, reject) {
        RestService.tupload('/tancredi/api/v1/firmware', file, progressCallback).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.deleteFirmware = function (filename) {
      return $q(function (resolve, reject) {
        RestService.tdelete('/tancredi/api/v1/firmware/' + filename).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // ringtone
    this.getRingtone = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/ringtones').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.uploadRingtone = function (file, progressCallback) {
      return $q(function (resolve, reject) {
        RestService.tupload('/tancredi/api/v1/ringtones', file, progressCallback).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.deleteRingtone = function (filename) {
      return $q(function (resolve, reject) {
        RestService.tdelete('/tancredi/api/v1/ringtones/' + filename).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // background
    this.getBackground = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/backgrounds').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.uploadBackground = function (file, progressCallback) {
      return $q(function (resolve, reject) {
        RestService.tupload('/tancredi/api/v1/backgrounds', file, progressCallback).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.deleteBackground = function (filename) {
      return $q(function (resolve, reject) {
        RestService.tdelete('/tancredi/api/v1/backgrounds/' + filename).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    // background
    this.getScreensaver = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/screensavers').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.uploadScreensaver = function (file, progressCallback) {
      return $q(function (resolve, reject) {
        RestService.tupload('/tancredi/api/v1/screensavers', file, progressCallback).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.deleteScreensaver = function (filename) {
      return $q(function (resolve, reject) {
        RestService.tdelete('/tancredi/api/v1/screensavers/' + filename).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }
  })