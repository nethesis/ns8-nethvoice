'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.PhoneService
 * @description
 * # PhoneService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('PhoneService', function ($q, RestService, UtilService) {

    // Retrieve the complete phone inventory
    this.getPhones = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/phones').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    // Create a new phone instance and add it to the phone inventory
    this.createPhone = function (phone) {
      return $q(function (resolve, reject) {
        RestService.tpost('/tancredi/api/v1/phones', phone).then(function (res) {
          resolve(res);
        }, function (err) {
          reject({ "error": err, "phone": phone });
        });
      });
    };

    // get phone
    this.getPhone = function (mac) {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/phones/' + mac).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    // get phone inherit
    this.getPhoneInherit = function (mac) {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/phones/' + mac + "?inherit=1").then(function (res) {
          resolve(res);
        }, function (err) {
          reject({ "error": err, "phone": phone });
        });
      });
    };

    this.setPhoneModel = function (mac, model) {
      return $q(function (resolve, reject) {
        RestService.tpatch('/tancredi/api/v1/phones/' + mac, { "model": model }).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.patchPhone = function (mac, phone) {
      return $q(function (resolve, reject) {
        RestService.tpatch('/tancredi/api/v1/phones/' + mac, phone).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    // Remove a phone from the inventory
    this.deletePhone = function (mac) {
      return $q(function (resolve, reject) {
        RestService.tdelete('/tancredi/api/v1/phones/' + mac).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.getDelayedReboot = function () {
      return $q(function (resolve, reject) {
        RestService.get('/phones/reboot').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    // Reboot one or more phone phones immediately or with a delay
    this.setPhoneReboot = function (rebootData) {
      return $q(function (resolve, reject) {
        RestService.post('/phones/reboot', rebootData).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.setPhoneReconfigure = function (reconfiguretData) {
      return $q(function (resolve, reject) {
        RestService.post('/phones/reconfigure', reconfiguretData).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.deletePhoneDelayedReboot = function (rebootCancelMacs) {
      return $q(function (resolve, reject) {
        RestService.deleteWithContentTypeJson('/phones/reboot', rebootCancelMacs).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.getMacVendors = function () {
      return $q(function (resolve, reject) {
        RestService.tget('/tancredi/api/v1/macvendors').then(function (res) {
          resolve(res)
        }, function (err) {
          reject(err)
        })
      })
    }

    this.removeMacSeparators = function (macAddress) {
      return macAddress.replace(/:|-/g, "");
    }

    this.getAllVendors = function (macVendors) {
      var vendorSet = new Set();
      Object.keys(macVendors).forEach(function (macPrefix) {
        var vendor = macVendors[macPrefix];
        vendor = UtilService.capitalize(vendor);
        vendorSet.add(vendor);
      });
      return Array.from(vendorSet);
    }
                              
    this.toRps = function (mac, obj) {
      return $q(function (resolve, reject) {
        RestService.post('/phones/rps/' + mac, obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.getVendor = function (macAddress, macVendors) {
      // remove separators
      macAddress = this.removeMacSeparators(macAddress).toUpperCase();
      var vendor = macVendors[macAddress.substring(0, 6)];
      if (vendor) {
        vendor = UtilService.capitalize(vendor);
      }
      return vendor;
    };

    this.checkMacAddress = function (macAddress) {
      // remove separators
      var macAddressNoSep = this.removeMacSeparators(macAddress);
      var regExp = /^[0-9a-fA-F]{12}$/;
      return regExp.test(macAddressNoSep);
    };

    this.normalizeMacAddress = function (macAddress) {
      // remove separators
      macAddress = this.removeMacSeparators(macAddress).toUpperCase();
      var chunks = [];
      var len;

      for (var i = 0, len = macAddress.length; i < len; i += 2) {
        chunks.push(macAddress.substr(i, 2))
      }
      return chunks.join('-');
    }

    this.checkNetmask = function (netmask) {
      var regExp = /^(((255\.){3}(255|254|252|248|240|224|192|128|0+))|((255\.){2}(255|254|252|248|240|224|192|128|0+)\.0)|((255\.)(255|254|252|248|240|224|192|128|0+)(\.0+){2})|((255|254|252|248|240|224|192|128|0+)(\.0+){3}))$/;
      return regExp.test(netmask)
    };

    this.getFilteredModels = function (mac, models, macVendors) {
      var vendor = this.getVendor(mac, macVendors);
      if (vendor) {
        var filteredModels = models.filter(function (model) {
          return model.name.toLowerCase().startsWith(vendor.toLowerCase());
        });
        return filteredModels;
      } else {
        return angular.copy(models);
      }
    }

    // Builds a phone starting from a phone got from Tancredi
    this.buildPhone = function (phoneTancredi, models, macVendors) {
      var mac = phoneTancredi.mac;
      var model;
      var filteredModels = this.getFilteredModels(mac, models, macVendors);

      if (phoneTancredi.model) {
        model = filteredModels.find(function (m) {
          return phoneTancredi.model === m.name;
        });
      }

      var vendor = phoneTancredi.display_name;
      if (!vendor) {
        vendor = this.getVendor(mac, macVendors);
      }

      if (vendor) {
        vendor = UtilService.capitalize(vendor);
      }

      var phone = {
        "mac": mac,
        "model": model,
        "vendor": vendor,
        "filteredModels": filteredModels
      }
      return phone;
    }

    // Builds a phone object that can be passed to Tancredi
    this.buildPhoneTancredi = function (mac, model, vendor, macVendors) {
      if (model) {
        model = model.name;
      }

      if (!vendor) {
        vendor = this.getVendor(mac, macVendors);
      }

      mac = this.formatMac(mac);

      var phone = {
        "mac": mac,
        "model": model,
        "display_name": vendor
      }
      return phone;
    }

    // Format a MAC address using hyphens as separators
    this.formatMac = function (mac) {
      mac = mac.toUpperCase();
      // remove all but alphanumeric characters
      mac = mac.replace(/\W/ig, '');
      // append an hyphen after every two characters
      mac = mac.replace(/(.{2})/g, "$1-");
      // remove trailing hyphen
      mac = mac.substring(0, mac.length - 1);
      return mac;
    }
  
  });