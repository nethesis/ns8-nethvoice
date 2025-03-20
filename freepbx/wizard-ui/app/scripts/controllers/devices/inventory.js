'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:DevicesInventoryCtrl
 * @description
 * # InventoryCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('DevicesInventoryCtrl', function ($scope, $rootScope, $interval, $q, $timeout, PhoneService, ModelService, UtilService, ConfigService, DeviceService, LocalStorageService, UserService) {
    $scope.phones = [];
    $scope.models = [];
    $scope.networkScanInProgress = false;
    $scope.view.changeRoute = true;
    $scope.pastedMacs = [];
    $scope.successfulAddPhones = [];
    $scope.failedAddPhones = [];
    $scope.failedRpsAddPhones = [];
    $scope.errors = [];
    $scope.errorId = 0;
    $scope.modelLoaders = {};
    $scope.showSuccessfullyAddedPhones = false;
    $scope.maxPastedMacCharacters = 3600;
    $scope.PHONES_PAGE = 15;
    $scope.phonesLimit = $scope.PHONES_PAGE;
    $scope.phonesLimit = 20

    const nethesisVendor = "Nethesis"
    const modelDigitsKey = 3
    const npx3Digits = "00"
    const npx5Digits = "01"
    const npx210Digits = "02"
    const npv61Digits = "03"  
    const npx5v2Digits = "04"
    const npx3Name = "nethesis-NPX3"
    const npx5Name = "nethesis-NPX5"
    const npx210Name = "nethesis-NPX210"
    const npv61Name = "nethesis-NPV61"
    const npx5v2Name = "nethesis-NPX5v2"

    function gotModels(models) {
      $scope.models = models;

      $timeout(function () {
        $("select").selectpicker('refresh');
      }, 1000);
    }

    $scope.searchPhoneString = "";
    $rootScope.$on('scrollingContainerView', function () {
      if($scope.phones){
        if ($scope.phones.length > $scope.phonesLimit) {
          $scope.phonesLimit += $scope.SCROLLPLUS
        }
      }
    });

    function gotPhones(phonesTancredi) {
      $scope.phones = [];
      phonesTancredi.forEach(function (phoneTancredi) {
        var phone = PhoneService.buildPhone(phoneTancredi, $scope.models, $scope.macVendors);
        $scope.phones.push(phone);
      });
      setTimeout(function () {
        $scope.$apply(function () {
          $scope.view.changeRoute = false;
        })
      }, 2000)
    }

    function gotNetworks(networks) {
      // assign network names
      // Check if networks is defined and is an object
      if (networks && typeof networks === 'object') {
        Object.keys(networks).forEach(function (networkName) {
          var network = networks[networkName];
          network.name = networkName;
        });
        $scope.networks = networks;
      } 
    }

    function gotDefaults(defaults) {
      $scope.defaults = defaults
    }

    function init() {
      initPopoversInfo()
      $scope.hideInventoryHelp = LocalStorageService.get('hideInventoryHelp');
      Promise.all([
        ModelService.getModels(),
        PhoneService.getPhones(),
        ConfigService.getNetworks(),
        ModelService.getDefaults()
      ]).then(function (res) {
        gotModels(res[0].data);
        gotPhones(res[1].data);
        gotNetworks(res[2].data);
        gotDefaults(res[3].data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving data");
        $scope.view.changeRoute = false;
      });
    }

    $scope.setHideInventoryHelp = function () {
      $scope.hideInventoryHelp = true;
      LocalStorageService.set('hideInventoryHelp', $scope.hideInventoryHelp);
    }

    $scope.getPhones = function () {
      PhoneService.getPhones().then(function (success) {
        gotPhones(success.data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving phones");
        $scope.view.changeRoute = false;
      });
    };

    $scope.getModels = function () {
      ModelService.getModels().then(function (success) {
        gotModels(success.data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving models");
      });
    }

    // modal used to add mac using different methods
    $scope.showGenericAddingModal = function (val) {
      $scope.addModalType = val;
      $('#adding-modal').modal("show");
    };

    $scope.showPasteModal = function () {
      $scope.phonesToAdd = [];
      $scope.pastedMacs = [];
      $scope.successfulAddPhones = [];
      $scope.failedAddPhones = [];
      $scope.failedRpsAddPhones = [];
      $scope.pendingRequestsAddPhones = 0;
      $scope.showResultsAddPhones = false;
      $scope.tooManyPastedMacs = false;
      $scope.showGenericAddingModal('copypaste');
      initCopyPasteMacUI();
    }

    function initCopyPasteMacUI() {
      initPopovers();
      $("#adding-modal").on('shown.bs.modal', function () {
        $('#paste-textarea').focus();
      });
    };

    function initPopovers() {
      $('[data-toggle=popover]').popovers()
        .on('hidden.bs.popover', function (e) {
          $(e.target).data('bs.popover').inState.click = false;
        });
    }

    function initPopoversInfo() {
      $('#provisioningInfoModal [data-toggle=popover]').popovers()
        .on('hidden.bs.popover', function (e) {
          $(e.target).data('bs.popover').inState.click = false;
        });
    }
    
    $scope.showManualModal = function () {
      $scope.phonesToAdd = [];
      $scope.successfulAddPhones = [];
      $scope.failedAddPhones = [];
      $scope.failedRpsAddPhones = [];
      $scope.pendingRequestsAddPhones = 0;
      $scope.showResultsAddPhones = false;
      $scope.showGenericAddingModal('manual');

      $timeout(function () {
        $('#manual-mac').focus();
      }, 500);
    }

    $scope.showScanModal = function () {
      $scope.phonesToAdd = [];
      $scope.successfulAddPhones = [];
      $scope.failedAddPhones = [];
      $scope.failedRpsAddPhones = [];
      $scope.pendingRequestsAddPhones = 0;
      $scope.showResultsAddPhones = false;
      $scope.showNoPhoneToAddFromNetwork = false;
      $scope.showGenericAddingModal('scanning');
    }

    $scope.addPhoneManual = function () {
      var validationOk = validateAddPhonesManual();

      if (!validationOk) {
        return;
      }

      var phone = {
        "mac": $scope.manualMac,
        "model": $scope.manualModel,
        "vendor": $scope.manualVendor,
        "filteredModels": $scope.manualFilteredModels
      };

      $scope.phonesToAdd.push(phone);
      $scope.setVendorApplyToAllList();
      validatePhonesToAdd();

      $scope.manualMac = "";
      $scope.manualModel = null;
      $scope.manualFilteredModels = [];
      $('#manual-mac').focus();
    }

    $scope.inputMacManualChanged = function () {
      $scope.clearValidationErrorsManual();

      if (!$scope.manualMac) {
        $scope.manualVendor = null;
        $scope.manualFilteredModels = [];
        return;
      }

      // update model list
      var vendor = PhoneService.getVendor($scope.manualMac, $scope.macVendors);

      if (vendor) {
        $scope.manualFilteredModels = $scope.models.filter(function (model) {
          return model.name.toLowerCase().startsWith(vendor.toLowerCase());
        });

        // force phone model when vendor is Nethesis
        if (vendor === nethesisVendor && $scope.manualMac && ($scope.manualFilteredModels.length > 0)) {
          let mac = $scope.manualMac.replace(/:/g, "-")
          if (mac.toUpperCase().split("-")[modelDigitsKey] === npx3Digits) {
            $scope.manualModel = $scope.manualFilteredModels.find(( model ) => { return model.name === npx3Name })
          } else if (mac.toUpperCase().split("-")[modelDigitsKey] === npx5Digits) {
            $scope.manualModel = $scope.manualFilteredModels.find(( model ) => { return model.name === npx5Name })
          } else if (mac.toUpperCase().split("-")[modelDigitsKey] === npx210Digits) {
            $scope.manualModel = $scope.manualFilteredModels.find(( model ) => { return model.name === npx210Name })
          } else if (mac.toUpperCase().split("-")[modelDigitsKey] === npv61Digits) {
            $scope.manualModel = $scope.manualFilteredModels.find(( model ) => { return model.name === npv61Name })		  
          } else if (mac.toUpperCase().split("-")[modelDigitsKey] === npx5v2Digits) {
            $scope.manualModel = $scope.manualFilteredModels.find(( model ) => { return model.name === npx5v2Name })
          }		  
        }
      } else {
        $scope.manualVendor = null;
        $scope.manualFilteredModels = angular.copy($scope.models);
      }
    }

    $scope.openProvisioningInfo = function (mac) {
      PhoneService.getPhone(mac).then(function (res) {
        $scope.currentPhoneInfo = res.data
        $scope.urlToCopy = res.data.provisioning_url1 ? res.data.provisioning_url1 : res.data.provisioning_url2
        $("#provisioningInfoModal").modal("show")
      }, function (err) {
        console.log(err)
      })
    }

    $scope.netmaskToScanChanged = function () {
      $scope.showNetmaskToScanError = false;
    }

    $scope.startNetworkScan = function () {
      $scope.showNetmaskToScanError = false;
      $scope.showNoPhoneToAddFromNetwork = false;

      var netName = $scope.networkToScan.name;

      if ($scope.networkToScan && (!$scope.networkToScan.netmask || !PhoneService.checkNetmask($scope.networkToScan.netmask))) {
        $scope.showNetmaskToScanError = true;
      }

      if ($scope.showNetmaskToScanError) {
        return;
      }

      // start scan
      $scope.phonesToAdd = [];
      $scope.networkScanInProgress = true;
      DeviceService.startScan($scope.networkToScan).then(function (res) {
        networkScanCompleted($scope.networkToScan);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error scanning network");
      });
    }

    function networkScanCompleted(network) {
      DeviceService.phoneListByNetwork(network).then(function (res) {
        // skip phones already present in inventory
        var phonesFromScan = res.data.filter(function (phoneFromScan) {
          var macFromScan = phoneFromScan.mac.replace(/:/g, "-");

          // check vendor
          var vendor = PhoneService.getVendor(macFromScan, $scope.macVendors);
          if (!vendor) {
            return false;
          }

          // check if already present in inventory
          var alreadyPresent = $scope.phones.find(function (phone) {
            return phone.mac === macFromScan;
          });
          return !alreadyPresent;
        });

        if (phonesFromScan.length == 0) {
          $scope.showNoPhoneToAddFromNetwork = true;
        }

        phonesFromScan.forEach(function (phoneFromScan) {
          var phoneToAdd = {
            "mac": phoneFromScan.mac.replace(/:/g, "-"),
            "ipv4": phoneFromScan.ipv4
          }
          $scope.phonesToAdd.push(phoneToAdd);

          // update model list
          $scope.macPhoneToAddChanged(phoneToAdd);
        });
        $scope.setVendorApplyToAllList();
        $scope.networkScanInProgress = false;
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving network scan results");
        $scope.networkScanInProgress = false;
      });
    }

    $scope.cancelAllNetworkScans = function (netName) {
    }

    $scope.clearValidationErrorsManual = function () {
      $scope.manualMacSyntaxError = false;
      $scope.manualMacUnknownVendor = false;
      $scope.manualMacDuplicated = false;
      $scope.manualMacInInventory = false;
    }

    $scope.clearValidationErrorsPhonesToAdd = function (phone) {
      if (typeof phone !== 'undefined') {
        // clear errors for a phone
        phone.invalidMac = false;
        phone.unknownVendor = false;
        phone.alreadyInInventory = false;
      } else {
        // clear all errors
        $scope.macDuplicates = [];

        $scope.phonesToAdd.forEach(function (phone) {
          phone.invalidMac = false;
          phone.unknownVendor = false;
          phone.alreadyInInventory = false;
        });
      }
    }

    function validatePhonesToAdd() {
      $scope.clearValidationErrorsPhonesToAdd();
      var firstErrorIndex = null;
      var macsPhonesToAdd = [];

      for (var index = 0; index < $scope.phonesToAdd.length; index++) {
        var phone = $scope.phonesToAdd[index];
        var mac = phone.mac;
        macsPhonesToAdd.push(mac);

        // check MAC address 
        if (!PhoneService.checkMacAddress(mac)) {
          phone.invalidMac = true;

          if (firstErrorIndex === null) {
            firstErrorIndex = index;
          }
        }

        // check MAC address already in inventory
        var alreadyInInventory = $scope.phones.find(function (phone) {
          return phone.mac === mac;
        });

        if (alreadyInInventory) {
          phone.alreadyInInventory = true;

          if (firstErrorIndex === null) {
            firstErrorIndex = index;
          }
        }

        if (!phone.invalidMac) {
          // check vendor
          var vendor = PhoneService.getVendor(mac, $scope.macVendors);
          if (!vendor) {
            phone.unknownVendor = true;

            if (firstErrorIndex === null) {
              firstErrorIndex = index;
            }
          } else {
            phone.vendor = vendor;
          }
        }
      }

      // check duplicates
      $scope.macDuplicates = UtilService.findDuplicates(macsPhonesToAdd);

      if (firstErrorIndex === null && $scope.macDuplicates.length) {
        firstErrorIndex = $scope.phonesToAdd.findIndex(function (phone) {
          return phone.mac === $scope.macDuplicates[0];
        });
      }

      // if there are validation errors, focus the first and return
      if (firstErrorIndex !== null && firstErrorIndex >= 0) {
        $timeout(function () {
          $('#mac-phone-to-add-' + firstErrorIndex).focus();
        }, 400);

        return false;
      } else {
        return true;
      }
    }

    $scope.addPhones = function () {
      if (!$scope.phonesToAdd || $scope.phonesToAdd.length == 0) {
        return;
      }

      var validationOk = validatePhonesToAdd();

      if (!validationOk) {
        return;
      }

      $scope.pendingRequestsAddPhones = $scope.phonesToAdd.length;
      $scope.failedAddPhones = [];
      $scope.failedRpsAddPhones = [];
      $scope.showSuccessfullyAddedPhones = false;

      $scope.addPhonesInProgress = true;

      // add all phones
      $scope.phonesToAdd.forEach(function (phone) {
        var phoneTancredi = PhoneService.buildPhoneTancredi(phone.mac, phone.model, phone.vendor, $scope.macVendors);
        // set formatted MAC
        phone.mac = phoneTancredi.mac;
        // create device on Tancredi
        PhoneService.createPhone(phoneTancredi).then(function (successTancredi) {
          // create device on Corbera
          var phoneCorbera = {
            mac: phoneTancredi.mac || null,
            model: phoneTancredi.model || null,
            line: null,
            web_user: 'admin',
            web_password: $scope.defaults.adminpw || 'admin'
          }
          UserService.createPhysicalExtension(phoneCorbera).then(function (successCorbera) {
            var phone = PhoneService.buildPhone(successTancredi.data, $scope.models, $scope.macVendors);
            $scope.pendingRequestsAddPhones--;
            $scope.successfulAddPhones.push(phone);
            if ($scope.pendingRequestsAddPhones == 0) {
              showResultsAddPhones();
            }
            // create field to the rps service
            PhoneService.getPhone(phoneCorbera.mac).then(function (res) {
              if (res.data.provisioning_url1) {
                PhoneService.toRps(phoneCorbera.mac, {
                  url: res.data.provisioning_url1
                }).then(function (res) {
                  // rps post success
                }, function (err) {
                  console.log(err)
                  $scope.failedRpsAddPhones.push({
                    mac: phoneCorbera.mac,
                    manualProvisioningUrlForFailure: res.data.provisioning_url2,
                    model: phone.model.display_name
                  });
                })
              }
            }, function (err) {
              console.log(err)
            })
          }, function (errorCorbera) {
            console.log(errorCorbera);
            $scope.pendingRequestsAddPhones--;
            $scope.failedAddPhones.push(errorCorbera);

            if ($scope.pendingRequestsAddPhones == 0) {
              showResultsAddPhones();
            }
          })
        }, function (errorTancredi) {
          console.log(errorTancredi.error.data.title);
          $scope.pendingRequestsAddPhones--;
          $scope.failedAddPhones.push(errorTancredi);

          if ($scope.pendingRequestsAddPhones == 0) {
            showResultsAddPhones();
          }
        });
      });
    }

    function showResultsAddPhones() {
      $scope.addPhonesInProgress = false;
      $scope.showResultsAddPhones = true;

      $scope.successfulAddPhones.forEach(function (phone) {
        $scope.deletePhoneToAdd(phone);
      });

      // show server errors on UI
      $scope.failedAddPhones.forEach(function (error) {
        var errorPhone = error.phone;

        var phone = $scope.phonesToAdd.find(function (p) {
          return p.mac === errorPhone.mac;
        });

        phone.serverError = error.error.data.title;
      });

      $scope.getPhones();
    }

    function validateAddPhonesManual() {
      $scope.clearValidationErrorsManual();
      var alreadyInInventory = false;

      if (!PhoneService.checkMacAddress($scope.manualMac)) {
        $scope.manualMacSyntaxError = true;
      } else {
        $scope.manualMac = PhoneService.normalizeMacAddress($scope.manualMac);
      }

      if (!$scope.manualMacSyntaxError) {
        // check vendor
        var vendor = PhoneService.getVendor($scope.manualMac, $scope.macVendors);

        if (!vendor) {
          $scope.manualMacUnknownVendor = true;
        }
      }

      // check duplicated MAC
      var duplicatedPhone = $scope.phonesToAdd.find(function (phone) {
        return phone.mac === $scope.manualMac;
      });

      if (duplicatedPhone) {
        $scope.manualMacDuplicated = true;
      } else {
        // check inventory too
        alreadyInInventory = $scope.phones.find(function (phone) {
          return phone.mac === $scope.manualMac;
        });

        if (alreadyInInventory) {
          $scope.manualMacInInventory = true;
        }
      }

      if ($scope.manualMacDuplicated || $scope.manualMacSyntaxError || $scope.manualMacUnknownVendor || $scope.manualMacInInventory) {
        $('#manual-mac').focus();
        return false;
      } else {
        return true;
      }
    }

    $scope.getManualFilteredModelsCount = function () {
      return $scope.manualFilteredModels && $scope.manualFilteredModels.length > 0 ? false : true;
    };

    $scope.checkTooManyPastedMacs = function () {
      if ($scope.pastedMacsText.length >= $scope.maxPastedMacCharacters - 2) {
        // warn the user
        $scope.tooManyPastedMacs = true;
      }
    }

    $scope.parsePastedMacs = function () {
      // remove separators (if any)
      $scope.pastedMacsText = $scope.pastedMacsText.replace(/,|;/g, ' ').trim();

      // split MAC addresses on whitespace
      $scope.pastedMacs = $scope.pastedMacsText.split(/\s+/);

      $scope.pastedMacsText = "";
      $scope.phonesToAdd = [];

      for (var index = 0; index < $scope.pastedMacs.length; index++) {
        var normalizedMac = PhoneService.normalizeMacAddress($scope.pastedMacs[index]);
        var phone = { "mac": normalizedMac };
        $scope.phonesToAdd.push(phone);

        // update model list
        $scope.macPhoneToAddChanged(phone);
      }

      validatePhonesToAdd();
      $scope.setVendorApplyToAllList();
    }

    $scope.vendorApplyToAllChanged = function () {
      if (!$scope.vendorApplyToAll) {
        $scope.modelApplyToAllList = [];
        return;
      }

      $scope.modelApplyToAllList = $scope.models.filter(function (model) {
        return model.name.toLowerCase().startsWith($scope.vendorApplyToAll.toLowerCase());
      });
    }

    $scope.setVendorApplyToAllList = function () {
      var vendorApplyToAllSet = new Set();

      $scope.phonesToAdd.forEach(function (phone) {
        var vendor = phone.vendor;
        if (!vendor) {
          vendor = PhoneService.getVendor(phone.mac, $scope.macVendors);
          phone.vendor = vendor;
        }

        if (vendor) {
          vendorApplyToAllSet.add(vendor);
        }
      });
      $scope.vendorApplyToAllList = Array.from(vendorApplyToAllSet);

      if ($scope.vendorApplyToAllList.length == 0) {
        // show all vendors
        $scope.vendorApplyToAllList = PhoneService.getAllVendors($scope.macVendors);
      }
    }

    $scope.applyModelToAll = function () {
      $scope.phonesToAdd.forEach(function (phone) {
        var vendor = phone.vendor;
        if (!vendor) {
          vendor = PhoneService.getVendor(phone.mac, $scope.macVendors);
          phone.vendor = vendor;
        }

        if ((vendor && $scope.modelApplyToAll.name.toLowerCase().startsWith(vendor.toLowerCase())) || !vendor) {
          var model = phone.filteredModels.find(function (m) {
            return m.name === $scope.modelApplyToAll.name;
          })

          if (model) {
            phone.model = model;
          }
        }
      });
    }

    $scope.macPhoneToAddChanged = function (phone) {
      $scope.clearValidationErrorsPhonesToAdd(phone);

      if (!phone.mac) {
        phone.vendor = null;
        phone.filteredModels = [];
        return;
      }

      // re-check duplicated MAC
      var macsPhonesToAdd = [];

      $scope.phonesToAdd.forEach(function (p) {
        macsPhonesToAdd.push(p.mac);
      });
      $scope.macDuplicates = UtilService.findDuplicates(macsPhonesToAdd);

      // check vendor
      var vendor = PhoneService.getVendor(phone.mac, $scope.macVendors);

      if (vendor) {
        phone.vendor = vendor;
        phone.filteredModels = $scope.models.filter(function (model) {
          return model.name.toLowerCase().startsWith(vendor.toLowerCase());
        });

        // force phone model when vendor is Nethesis
        if (phone.vendor === nethesisVendor && phone.mac && (phone.filteredModels.length > 0)) {
          let mac = phone.mac.replace(/:/g, "-")
          if (mac.toUpperCase().split("-")[modelDigitsKey] === npx3Digits) {
            phone.model = phone.filteredModels.find(( model ) => { return model.name === npx3Name })
          } else if (mac.toUpperCase().split("-")[modelDigitsKey] === npx5Digits) {
            phone.model = phone.filteredModels.find(( model ) => { return model.name === npx5Name })
          } else if (mac.toUpperCase().split("-")[modelDigitsKey] === npx210Digits) {
            phone.model = phone.filteredModels.find(( model ) => { return model.name === npx210Name })
          } else if (mac.toUpperCase().split("-")[modelDigitsKey] === npv61Digits) {
            phone.model = phone.filteredModels.find(( model ) => { return model.name === npv61Name })
          } else if (mac.toUpperCase().split("-")[modelDigitsKey] === npx5v2Digits) {
            phone.model = phone.filteredModels.find(( model ) => { return model.name === npx5v2Name })
          }
        }
      } else {
        phone.vendor = null;
        phone.filteredModels = angular.copy($scope.models);

        // unknown vendor warning
        if (phone.mac.length >= 8) {
          phone.unknownVendor = true;
        }
      }
    }

    $scope.setPhoneModel = function (phone) {
      var model = null;
      if (phone.model) {
        model = phone.model.name;
      }
      $scope.modelLoaders[phone.mac] = 'loading';

      // set phone model on Tancredi
      PhoneService.setPhoneModel(phone.mac, model).then(function (res) {
        // set phone model on Corbera
        UserService.setPhoneModel(phone.mac, model).then(function (res) {
          $scope.modelLoaders[phone.mac] = 'success';
          resetModelLoaderDelayed(phone.mac);
        }, function (errorCorbera) {
          console.log(errorCorbera);
          addErrorNotification(errorCorbera.data, "Error setting phone model");
          $scope.modelLoaders[phone.mac] = 'fail';
          resetModelLoaderDelayed(phone.mac);
        });
      }, function (errorTancredi) {
        console.log(errorTancredi);
        addErrorNotification(errorTancredi.data, "Error setting phone model");
        $scope.modelLoaders[phone.mac] = 'fail';
        resetModelLoaderDelayed(phone.mac);
      });
    };

    function resetModelLoaderDelayed(mac) {
      $timeout(function () {
        $scope.modelLoaders[mac] = null;
      }, 3000);
    }

    $scope.showDeletePhoneModal = function (phone) {
      $scope.phoneToDelete = phone;
    }

    $scope.deletePhone = function () {
      $('#deletePhoneModal').modal('hide');
      // delete phone on Tancredi
      PhoneService.deletePhone($scope.phoneToDelete.mac).then(function (res) {
        $scope.getPhones();
        // delete phone on Corbera
        UserService.deletePhysicalExtension($scope.phoneToDelete.mac).then(function (res) {
          // delete delayed reboot (if present)
          PhoneService.deletePhoneDelayedReboot([$scope.phoneToDelete.mac]).then(function (res) {
          }, function (err) {
            console.log(err);
            addErrorNotification(err.data, "Error canceling delayed reboot");
          });
        }, function (errorCorbera) {
          console.log(errorCorbera);
          addErrorNotification(errorCorbera.data, "Error deleting phone");
        });
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error deleting phone");
      });
    }

    $scope.deletePhoneToAdd = function (phoneToDelete) {
      $scope.phonesToAdd = $scope.phonesToAdd.filter(function (phone) {
        return phone.mac.toUpperCase() !== phoneToDelete.mac.toUpperCase();
      });

      $scope.setVendorApplyToAllList();
    }

    $scope.deletePhoneToAddIndex = function (index) {
      $scope.phonesToAdd.splice(index, 1);
      $scope.setVendorApplyToAllList();
    }

    $scope.orderByValue = function (value) {
      return value;
    };

    $scope.getNetworks = function () {
      ConfigService.getNetworks().then(function (success) {
        gotNetworks(success.data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving network interfaces");
      });
    };

    $scope.deleteError = function (errorId) {
      $scope.errors = $scope.errors.filter(function (error) {
        return error.id !== errorId;
      });
    }

    function addErrorNotification(error, i18nMessage, warning) {
      error.i18nMessage = i18nMessage;
      error.id = $scope.errorId;
      error.warning = warning;
      $scope.errorId++;
      $scope.errors.push(error);
    }

    $scope.toggleShowSuccessfullyAddedPhones = function () {
      $scope.showSuccessfullyAddedPhones = !$scope.showSuccessfullyAddedPhones;
    }

    // only for dev purposes
    var deletePhoneDev = function (phone) {
      // delete phone on Tancredi
      PhoneService.deletePhone(phone.mac).then(function (res) {
        // delete phone on Corbera
        UserService.deletePhysicalExtension(phone.mac).then(function (res) {
          // delete delayed reboot (if present)
          PhoneService.deletePhoneDelayedReboot([phone.mac]).then(function (res) {
          }, function (err) {
            console.log(err);
            addErrorNotification(err.data, "Error canceling delayed reboot");
          });
        }, function (errorCorbera) {
          console.log(errorCorbera);
          addErrorNotification(errorCorbera.data, "Error deleting phone");
        });
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error deleting phone");
      });
    }

    // only for dev purposes
    $scope.deleteAllPhonesDev = function() {
      $scope.phones.forEach(function (phone) {
        deletePhoneDev(phone)
      });
    }

    $('#provisioningInfoModal').on('hide.bs.modal', function () {
      $("#provisioningInfoModal #showurlbtn").popover("hide")
      $scope.currentPhoneInfo = {}
    })

    angular.element(document).ready(function () {
      if (!$scope.macVendors) {
        PhoneService.getMacVendors().then(function (res) {
          $scope.$parent.macVendors = res.data
          init()
        }, function (err) {
          console.log(err)
        })
      } else {
        init()
      }
    })

  });
