'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.ConfigService
 * @description
 * # ConfigService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('ConfigService', function($q, RestService) {
    this.getConfig = function() {
      return $q(function(resolve, reject) {
        RestService.get('/configuration/userprovider').then(function(res) {
          resolve(res);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.setConfig = function(mode) {
      return $q(function(resolve, reject) {
        RestService.post('/configuration/mode', {
          mode: mode
        }).then(function(res) {
          resolve(res);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.getNetworks = function() {
      return $q(function(resolve, reject) {
        RestService.get('/configuration/networks').then(function(res) {
          resolve(res);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.getWizard = function() {
      return $q(function(resolve, reject) {
        RestService.get('/configuration/wizard').then(function(res) {
          resolve(res.data);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.setWizard = function(wizard) {
      return $q(function(resolve, reject) {
        RestService.post('/configuration/wizard', wizard).then(function(res) {
          resolve(res);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.setPBXLang = function(lang) {
      return $q(function(resolve, reject) {
        RestService.post('/settings/language', lang).then(function(res) {
          resolve(res);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.setDefaultPBXLang = function(lang) {
      return $q(function(resolve, reject) {
        RestService.post('/settings/defaultlanguage', lang).then(function(res) {
          resolve(res);
        }, function(err) {
          reject(err);
        });
      });
    };

    this.getProvisioningInfo = function () {
      return $q(function (resolve, reject) {
        RestService.get('/provisioning/engine').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        });
      });
    }

    this.getExternalIp = function () {
      return $q(function (resolve, reject) {
        RestService.get('/configuration/externalip').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.getSuggestedIp = function () {
      return $q(function (resolve, reject) {
        RestService.get('/configuration/suggestedip').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.setExternalIp = function(ip) {
      return $q(function(resolve, reject) {
        RestService.post('/configuration/externalip/' + ip).then(function(res) {
          resolve(res)
        }, function(err) {
          reject(err)
        })
      })
    }

    this.getLocalNetworks = function () {
      return $q(function (resolve, reject) {
        RestService.get('/configuration/localnetworks').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.getExternalSip = function() {
      return $q(function(resolve, reject) {
        RestService.get('/configuration/allowexternalsips').then(function(res) {
          resolve(res)
        }, function(err) {
          reject(err)
        })
      })
    }

    this.setExternalSip = function(val) {
      return $q(function(resolve, reject) {
        RestService.post('/configuration/allowexternalsips/' + val).then(function(res) {
          resolve(res)
        }, function(err) {
          reject(err)
        })
      })
    }

    this.setLocalNetworks = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/configuration/localnetworks', obj).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.switchPhonebookJss = function (status) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/ldaps/status/' + status).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.switchPhonebookJs = function (status) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/ldap/status/' + status).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.getPhonebookSettings = function () {
      return $q(function(resolve, reject) {
        RestService.get('/phonebook/sources').then(function(res) {
          resolve(res)
        }, function(err) {
          reject(err)
        })
      })
    }

    this.switchRapidCode = function (status) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/sources/speeddial/' + status).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.switchPbxExtensions = function (status) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/sources/extensions/' + status).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.switchPublicContacts = function (status) {
      return $q(function (resolve, reject) {
        RestService.post('/phonebook/sources/nethcti/' + status).then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.getConferenceUrl = function () {
      return $q(function (resolve, reject) {
        RestService.get('/settings/conferenceurl').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.setConferenceUrl = function (url) {
      return $q(function (resolve, reject) {
        RestService.post('/settings/conferenceurl', {"url": url}).then(function(res) {
          resolve(res);
        }, function(err) {
          reject(err);
        });
      })
    }

  });