'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:OtherConfigurationsCtrl
 * @description
 * # OtherConfigurationsCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('OtherConfigurationsCtrl', function ($scope, $rootScope, $filter, UserService, DeviceService, ProfileService, UtilService) {
    $scope.users = {};
    $scope.selectedUser = null;
    $scope.devices = [];
    $scope.allProfiles = [];
    $scope.allGroups = [];
    $scope.maxExtensionReached = false;
    $scope.view.changeRoute = true;
    $scope.newDevice = {};

    $scope.usersLimit = 20
    $scope.devicesLimit = 20

    $scope.availableUserFilters = ['all', 'configured', 'unconfigured'];
    $scope.availableUserFiltersNumbers = ['lname', 'default_extension'];
    $scope.selectedUserFilter = $scope.availableUserFilters[0];
    $scope.selectedUserFilterNumbers = $scope.availableUserFiltersNumbers[0];

    $scope.availableDeviceFilters = ['all', 'linked', 'unlinked'];
    $scope.selectedDeviceFilter = $scope.availableDeviceFilters[0];

    $scope.cancelError = function () {
      $scope.maxExtensionReached = false;
    };

    $scope.scrollingUserContainer = function () {
      if ($scope.users) {
        if ($scope.users.length > $scope.usersLimit) {
          $scope.usersLimit += $scope.SCROLLPLUS
        }
      }
    }

    $scope.scrollingDeviceContainer = function () {
      if ($scope.devices) {
        if ($scope.devices.length > $scope.devicesLimit) {
          $scope.devicesLimit += $scope.SCROLLPLUS
        }
      }
    }

    $scope.getAllProfiles = function () {
      ProfileService.allProfiles().then(function (res) {
        $scope.allProfiles = res.data;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getAllGroups = function () {
      ProfileService.allGroups().then(function (res) {
        $scope.allGroups = res.data;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getUserList = function () {
      UserService.list(false).then(function (res) {
        $scope.users = res.data;
        $scope.getDeviceList();
        var index = 0;
        for (var u in $scope.users) {
          if ($scope.users[u].default_extension !== 'none') {
            index = u;
            break;
          } else {
            continue;
          }
        }
        $scope.selectUser($scope.currentUserIndex || $scope.users[index], true);
        if ($scope.mode.isLdap && UtilService.isEmpty($scope.users)) {
          $scope.wizard.nextState = false;
        }
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getDeviceList = function () {
      DeviceService.phoneList().then(function (res) {
        $scope.view.changeRoute = false;
        $scope.devices = res.data;
      }, function (err) {
        $scope.view.changeRoute = false;
        console.log(err);
      });
    };

    $scope.getNameFromExtension = function (main) {
      if ($scope.users.filter) {
        var returned = $scope.users.filter(function (obj) {
          if (obj.default_extension == main) {
            return obj;
          }
        })[0];
        return returned && returned.displayname ? returned.displayname : '';
      }
    };

    $scope.resetDeviceSearch = function () {
      $scope.searchDeviceUserString = '';
    }

    $scope.selectUser = function (user, first) {
      if (!first) {
        if (user.devices.length > 0) {
          for (var d in user.devices) {
            if (user.devices[d].type === 'physical'  || user.devices[d].type === 'temporaryphysical') {
              $scope.searchDeviceUserString = user.username;
              break;
            } else {
              $scope.searchDeviceUserString = '';
            }
          }
        } else {
          $scope.searchDeviceUserString = '';
        }
      }
      if (user.default_extension !== 'none') {
        $scope.currentUserIndex = user;
        $scope.selectedUser = $scope.users.filter(function (obj) {
          if (obj.id == user.id) {
            return obj;
          }
        })[0];
        ProfileService.getUserGroup($scope.selectedUser.id).then(function (res) {
          $scope.selectedUser.groups = res.data;
        }, function (err) {
          if (err.status != 404) {
            console.log(err);
          }
        });
        UserService.getVoiceMail($scope.selectedUser.default_extension).then(function (res) {
          if (res.data && res.data.mailbox) {
            $scope.selectedUser.voiceMailState = true;
          } else {
            $scope.selectedUser.voiceMailState = false;
          }
        }, function (err) {
          if (err.status != 404) {
            console.log(err);
          }
          $scope.selectedUser.voiceMailState = false;
        });
        UserService.getMobileNumber($scope.selectedUser.username).then(function (res) {
          $scope.selectedUser.mobile = res.data;
        }, function (err) {
          if (err.status != 404) {
            console.log(err);
          }
        });
        UserService.getWebRTCExtension($scope.selectedUser.default_extension).then(function (res) {
          $scope.selectedUser.webRtcState = true;
        }, function (err) {
          if (err.status != 404) {
            console.log(err)
          }
          $scope.selectedUser.webRtcState = false;
        });
        UserService.getMobileExtension($scope.selectedUser.default_extension).then(function (res) {
          $scope.selectedUser.mobileAppState = true
        }, function (err) {
          if (err.status != 404) {
            console.log(err)
          }
          $scope.selectedUser.mobileAppState = false
        })
      }
    };

    $scope.configureAndRebootPhone = function (device) {
      device.setPhysicalInAction = true;
      DeviceService.generateDeviceConfig({
        mac: device.mac,
      }).then(function (res) {
        DeviceService.rebootPhone({
          mac: device.mac,
          ip: device.ipv4
        }).then(function (res1) {
          console.log(res1);
          device.setPhysicalInAction = false;
          device.inError = false;
        }, function (err1) {
          console.log(err1);
          device.setPhysicalInAction = false;
          device.inError = true;
        });
      }, function (err) {
        console.log(err);
        device.setPhysicalInAction = false;
        device.inError = true;
      });
    };

    $scope.bulkPhonesConfiguration = function (str) {
      var devices = $filter('filter')($scope.devices, str);
      for (var d in devices) {
        if ($scope.isConfigured(devices[d])) {
          $scope.configureAndRebootPhone(devices[d]);
          $('#bulkModal').modal('hide');
        }
      }
    }

    $scope.isConfigured = function (device) {
      for (var l in device.lines) {
        var line = device.lines[l];
        if (line.extension) {
          return true;
        }
      }
    };

    $scope.setMobileApp = function (mainextension) {
      UserService.createMobileExtension({
        "mainextension": mainextension
      }).then(function (res){
        $scope.selectedUser.mobileAppState = true
        $scope.selectedUser.devices[Object.keys($scope.selectedUser.devices).length] = {
          "type": "mobile",
          "extension": res.data.extension
        }
      }, function (err) {
        console.log("err", err)
      })
    }

    $scope.setMobileNumber = function (user) {
      $scope.selectedUser.setMobileInAction = true;
      UserService.createMobileNumber({
        username: user.username,
        mobile: user.mobile
      }).then(function (res) {
        $scope.selectedUser.setMobileInAction = false;
      }, function (err) {
        console.log(err);
        $scope.selectedUser.setMobileInAction = false;
      });
    }

    $scope.deleteMobileApp = function (extension) {
      UserService.deleteMobileExtension(extension).then(function (){
        $scope.selectedUser.mobileAppState = false
        for (let device in $scope.selectedUser.devices) {
          if ($scope.selectedUser.devices[device].type == "mobile") {
            delete $scope.selectedUser.devices[device]
          }
        }
      }, function (err) {
        console.log("err", err)
      })
    }

    $scope.toggleMobileApp = function () {
      if ($scope.selectedUser.mobileAppState) {
        $scope.setMobileApp($scope.selectedUser.default_extension)
      } else {
        let mobileExt
        for (let device in $scope.selectedUser.devices) {
          if ($scope.selectedUser.devices[device].type == "mobile") {
            mobileExt = $scope.selectedUser.devices[device].extension
          }
        }
        $scope.deleteMobileApp(mobileExt)
      }
    }

    $scope.setPhysicalExtension = function (user, device, line) {
      device.setPhysicalInAction = true;
      UserService.createPhysicalExtension({
        mainextension: user.default_extension,
        mac: device.mac || null,
        model: device.model || null,
        line: line || null,
        web_user: device.web_user || 'admin',
        web_password: device.web_password || 'admin',
        clear_temporary: true
      }).then(function (res) {
        device.setPhysicalInAction = false;
        device.web_password = '';
        device.web_user = '';
        $scope.getUserList(false);
      }, function (err) {
        device.setPhysicalInAction = false;
        console.log(err);
        if (err.data.status == "There aren't available extension numbers") {
          $scope.maxExtensionReached = true;
        }
      });
    };

    $scope.deletePhysicalExtension = function (device, extension) {
      device.setPhysicalInAction = true;
      UserService.deletePhysicalExtension(extension).then(function (res) {
        device.setPhysicalInAction = false;
        $scope.getUserList(false);
        console.log(res);
      }, function (err) {
        device.setPhysicalInAction = false;
        console.log(err);
      });
    };

    $scope.setVoiceMail = function () {
      $scope.selectedUser.setVoiceMailInAction = true;
      UserService.createVoiceMail({
        extension: $scope.selectedUser.default_extension,
        state: $scope.selectedUser.voiceMailState ? 'yes' : 'no'
      }).then(function (res) {
        $scope.selectedUser.setVoiceMailInAction = false;
      }, function (err) {
        console.log(err);
        $scope.selectedUser.setVoiceMailInAction = false;
      });
    };

    $scope.setWebRTC = function (event, state) {
      $scope.selectedUser.setWebRTCInAction = true;
      if ($scope.selectedUser.webRtcState) {
        UserService.createWebRTCExtension({
          extension: $scope.selectedUser.default_extension
        }).then(function (res) {
          $scope.selectedUser.setWebRTCInAction = false;
          $scope.getUserList(false);
        }, function (err) {
          console.log(err);
          $scope.selectedUser.setWebRTCInAction = false;
        });
      } else {
        UserService.deleteWebRTCExtension($scope.selectedUser.default_extension).then(function (res) {
          $scope.selectedUser.setWebRTCInAction = false;
          $scope.getUserList(false);
        }, function (err) {
          console.log(err);
          $scope.selectedUser.setWebRTCInAction = false;
        });
      }
    };

    $scope.setAppMobile = function (event, state) {
      $scope.selectedUser.setAppMobileInAction = true;
      /*UserService.createVoiceMail({
        extension: $scope.selectedUser.default_extension,
        state: state ? 'yes' : 'no'
      }).then(function (res) {
        $scope.selectedUser.setVoiceMailInAction = false;
      }, function (err) {
        console.log(err);
        $scope.selectedUser.setVoiceMailInAction = false;
      });*/
    };

    $scope.setProfile = function () {
      ProfileService.setUserProfile($scope.selectedUser.id, {
        profile_id: $scope.selectedUser.profile
      }).then(function (res) {
        console.log(res);
      }, function (err) {
        console.log(err);
      });
    };

    $scope.setGroup = function () {
      ProfileService.setUserGroup($scope.selectedUser.id, {
        groups: $scope.selectedUser.groups
      }).then(function (res) {
        console.log(res);
      }, function (err) {
        console.log(err);
      });
    };

    $scope.checkConfiguredExtensions = function (device, filter) {
      if (filter == 'all') {
        return true;
      }
      var count = device.lines.length;
      for (var l in device.lines) {
        var line = device.lines[l];
        if (line.extension) {
          count--;
        }
      }
      return filter == 'unlinked' ? count == device.lines.length : count != device.lines.length;
    };

    $scope.getUserList();
    $scope.getAllProfiles();
    $scope.getAllGroups();
  });
