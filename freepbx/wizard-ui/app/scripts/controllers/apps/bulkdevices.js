'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:BulkdevicesCtrl
 * @description
 * # BulkdevicesCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('BulkdevicesCtrl', function ($scope, $rootScope, $filter, $timeout, PhoneService, ModelService, UserService, ProfileService) {
    $scope.models = [];
    $scope.phones = [];
    $scope.numFiltered = 0;
    $scope.numSelected = 0;
    $scope.view.changeRoute = true;
    $scope.errors = [];
    $scope.errorId = 0;
    $scope.phonesLimit = 20;

    var chooseModel = {
      "id": 0,
      "display_name": $filter('translate')('Choose') + "..."
    };

    function init() {
      Promise.all([
        ModelService.getModels(),
        UserService.list(true),
        PhoneService.getPhones(),
        ProfileService.allGroups(),
      ]).then(function (res) {
        gotModels(res[0].data);
        gotUsers(res[1].data);
        gotPhones(res[2].data);
        gotGroups(res[3].data);
        gotDelayedReboot(res[4].data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving data");
        $scope.view.changeRoute = false;
      });
    }

    $scope.$watch("phones", function (newValue, oldValue) {
      $scope.numFiltered = 0;
      $scope.numSelected = 0;
      $scope.allSelectedSameVendor = null;
      $scope.allSelectedSameModel = "";
      $scope.somePhonesRegistered = false;

      // remove 'Choose' option from models
      $scope.models = $scope.models.filter(function (model) {
        return model.id !== 0;
      });

      $scope.phones.forEach(function (phone) {
        if (phone.filtered) {
          $scope.numFiltered++;
        }

        if (phone.selected) {
          $scope.numSelected++;

          // check if all phones selected have the same vendor
          if ($scope.allSelectedSameVendor == null && phone.vendor) {
            $scope.allSelectedSameVendor = phone.vendor;
          } else if (phone.vendor !== $scope.allSelectedSameVendor || !phone.vendor) {
            $scope.allSelectedSameVendor = false;
          }

          // check if all phones selected have the same model
          if ($scope.allSelectedSameModel === "") {
            $scope.allSelectedSameModel = phone.model;
          } else if (phone.model !== $scope.allSelectedSameModel) {
            $scope.allSelectedSameModel = false;
          }

          // check if some of the phones selected are registered
          if (!$scope.somePhonesRegistered && phone.registered) {
            $scope.somePhonesRegistered = true;
          }
        }
      });
    }, true);

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

    var defaultDelayedRebootValue = function () {
      // current time, rounded by 5 minutes
      var d = new Date();
      d.setMinutes(5 * Math.ceil(d.getMinutes() / 5));
      d.setSeconds(0);
      d.setMilliseconds(0);
      return d;
    }

    function gotDelayedReboot(rebootData) {
      // clear old reboot times
      $scope.phones.forEach(function (phone) {
        phone.delayedReboot = null;
      });

      // reset bulk delayed reboot value
      $scope.bulkDelayedReboot = defaultDelayedRebootValue();

      // set updated reboot times
      Object.keys(rebootData).forEach(function (mac) {
        var time = rebootData[mac];
        var phone = $scope.phones.find(function (phone) {
          return phone.mac === mac;
        });

        if (phone) {
          var rebootTime = new Date();
          rebootTime.setHours(time.hours);
          rebootTime.setMinutes(time.minutes);
          phone.delayedReboot = rebootTime;
        }
      });
    }

    function gotPhones(phones) {
      $scope.filteredGroup = null;
      $scope.filteredModel = null;
      $scope.phones = [];
      phones.forEach(function (phoneTancredi) {
        var phone = PhoneService.buildPhone(phoneTancredi, $scope.models, $scope.macVendors);
        phone.filtered = true;
        $scope.phones.push(phone);
      });
      // set phone.user
      $scope.phones.forEach(function (phone) {
        $scope.users.forEach(function (user) {
          user.devices.forEach(function (device) {
            if (device.mac === phone.mac) {
              phone.user = user;
              phone.registered = device.registered;
            }
          });
        });
      });
      $scope.view.changeRoute = false;
    }

    $scope.getPhones = function () {
      PhoneService.getPhones().then(function (success) {
        gotPhones(success.data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving phones");
      });
    };

    function gotUsers(users) {
      // normalize MAC address of user devices
      users.forEach(function (user) {
        user.devices.forEach(function (device) {
          if (device.mac) {
            var normalizedMac = PhoneService.normalizeMacAddress(device.mac);
            device.mac = normalizedMac;
          }
        });
      });
      $scope.users = users;
    }

    $scope.getUsers = function () {
      UserService.list(true).then(function (res) {
        gotUsers(res.data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving users");
      });
    }

    function gotGroups(groups) {
      $scope.groups = groups;

      // associate users and groups
      $scope.users.forEach(function (user) {
        setUserGroups(user);
      });
    }

    $scope.getGroups = function () {
      ProfileService.allGroups().then(function (res) {
        gotGroups(res.data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving groups");
      });
    }

    function setUserGroups(user) {
      ProfileService.getUserGroup(user.id).then(function (res) {
        user.groups = res.data;
      }, function (err) {
        if (err.status != 404) {
          console.log(err);
        }
      });
    }

    $scope.clearFilters = function () {
      $scope.filteredGroup = null;
      $scope.filteredModel = null;
      $scope.filterPhones();
    }

    $scope.filterPhones = function () {
      var defaultFilterValue = false;
      $scope.phonesLimit = appConfig.PHONES_PER_PAGE;
      $('#phone-list')[0].scrollTop = 0;

      if (!$scope.filteredGroup && !$scope.filteredModel) {
        // no filter, show all phones
        defaultFilterValue = true;
      }

      // clear selection and set default filter value
      $scope.phones.forEach(function (phone) {
        phone.filtered = defaultFilterValue;
        phone.selected = false;
      });

      if (!$scope.filteredGroup && !$scope.filteredModel) {
        // no filter, nothing else to do
        return;
      }

      if ($scope.filteredGroup) {
        var users = $scope.users.filter(function (user) {
          return user.groups.includes($scope.filteredGroup.id);
        })

        users.forEach(function (user) {
          user.devices.forEach(function (device) {
            var phone = $scope.phones.find(function (phone) {
              return phone.mac === device.mac;
            });

            if (phone) {
              if ($scope.filteredModel) {
                // group and model selected
                if (phone.model && phone.model.name === $scope.filteredModel.name) {
                  phone.filtered = true;
                }
              } else {
                // group selected only
                phone.filtered = true;
              }
            }
          });
        });
      } else {
        // model selected only
        $scope.phones.forEach(function (phone) {
          if (phone.model && phone.model.name === $scope.filteredModel.name) {
            phone.filtered = true;
          }
        });
      }
    }

    function gotModels(models) {
      $scope.models = models;
    }

    $scope.getModels = function () {
      ModelService.getModels().then(function (res) {
        gotModels(res.data);
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error retrieving models");
      });
    }

    $scope.bulkModelSave = function () {
      var model = null;
      if ($scope.bulkModel) {
        model = $scope.bulkModel.name;
      }
      var setModelPromises = [];

      $scope.phones.forEach(function (phone) {
        if (phone.selected) {
          // set phone model on Tancredi
          setModelPromises.push(PhoneService.setPhoneModel(phone.mac, model));
          // set phone model on Corbera
          setModelPromises.push(UserService.setPhoneModel(phone.mac, model));
        }
      });
      Promise.all(setModelPromises).then(function (success) {
        $scope.getPhones();
      }, function (err) {
        console.log(err);
        addErrorNotification(err.data, "Error setting phone model");
      });
      $('#bulkModelModal').modal('hide');
    }

    function zeroPad(value) {
      // zero padding to two digits
      var valueStr = value.toString();

      if (valueStr.length > 1) {
        return valueStr;
      } else if (valueStr.length == 1) {
        return '0' + valueStr;
      } else {
        return '00';
      }
    }

    $scope.toggleShowPhonesNotRebooted = function () {
      $scope.showPhonesNotRebooted = !$scope.showPhonesNotRebooted;
    }

    $scope.bulkRebootNow = function () {
      $scope.showPhonesNotRebooted = false;
      $scope.rebootNowInProgress = true;
      $scope.phonesNotRebooted = [];
      
      var reconfigurePromises = [];
      
      $scope.phones.forEach(function (phone) {
        if (phone.selected && phone.user) {
          // Find an extension to reconfigure
          var extensionToReconfigure = null;
          phone.user.devices.forEach(function(device) {
            if (device.mac === phone.mac && device.extension) {
              extensionToReconfigure = device.extension;
            }
          });
          
          if (extensionToReconfigure) {
            // Add the promise for reconfiguration
            reconfigurePromises.push(
              PhoneService.setPhoneReconfigure({
                extension: extensionToReconfigure
              }).then(function(success) {
                return { mac: phone.mac, success: true };
              }, function(error) {
                $scope.phonesNotRebooted.push(phone);
                return { mac: phone.mac, success: false };
              })
            );
          } else {
            // No extension found for this phone
            $scope.phonesNotRebooted.push(phone);
          }
        }
      });
      
      // Wait for all reconfigurations to complete
      Promise.all(reconfigurePromises).then(function(results) {
        $scope.rebootNowInProgress = false;
        $scope.showResultsRebootNow = true;
        
        if (!$scope.phonesNotRebooted.length) {
          // Complete success
          $scope.hideRebootNowModalTimeout = $timeout(function () {
            $('#reboot-now-modal').modal('hide');
          }, 2500);
        }
      }, function(error) {
        console.log(error);
        $scope.rebootNowInProgress = false;
        addErrorNotification({ error: "General error during reconfiguration" }, "Error reconfiguring phones");
        $('#reboot-now-modal').modal('hide');
      });
    }

    $scope.showRebootNowModal = function () {
      $scope.showResultsRebootNow = false;
      $timeout.cancel($scope.hideRebootNowModalTimeout);
      $('#reboot-now-modal').modal('show');
    }

    $scope.showSetModelModal = function () {
      if ($scope.allSelectedSameVendor) {
        $scope.filteredModels = $scope.models.filter(function (model) {
          return model.name.toLowerCase().startsWith($scope.allSelectedSameVendor.toLowerCase());
        });
      } else {
        // show all models
        $scope.filteredModels = angular.copy($scope.models);
      }

      if ($scope.allSelectedSameModel != false) {
        $scope.bulkModel = $scope.allSelectedSameModel;
      } else {
        $scope.bulkModel = chooseModel;
        $scope.filteredModels.push(chooseModel);
      }
      $('#bulkModelModal').modal('show');
    }

    $scope.selectAllOrNoneToggle = function () {
      var value = null;
      if ($scope.numSelected !== $scope.numFiltered) {
        // select all
        value = true;
      } else {
        // select none
        value = false;
      }
      $scope.phones.forEach(function (phone) {
        if (phone.filtered) {
          phone.selected = value;
        }
      });
    }

    $rootScope.$on('scrollingContainerView', function () {
      if($scope.phones){
        if ($scope.phones.length > $scope.phonesLimit) {
          $scope.phonesLimit += $scope.SCROLLPLUS
        }
      }
    });

    var scrollBulkDevices = function () {
      $scope.$apply(function () {
        $scope.phonesLimit += $scope.PHONES_PAGE
      })
    }

    document.addEventListener('bulkDevicesScroll', scrollBulkDevices)

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
