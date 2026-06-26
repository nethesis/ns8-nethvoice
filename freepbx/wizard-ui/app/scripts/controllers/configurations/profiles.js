'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:UsersProfilesCtrl
 * @description
 * # UsersProfilesCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('UsersProfilesCtrl', function ($scope, UserService, ProfileService, $timeout) {
    $scope.allProfiles = [];
    $scope.allPermissions = [];
    $scope.allGroups = [];

    $scope.onSaveSuccess = false;
    $scope.onSaveError = false;
    $scope.gruopsDisabled = false;
    $scope.permissionsStatus = {};
    $scope.outboundStatus = {};
    $scope.phonebookPermissionsStatus = {};

    $scope.phonebookPermissionLevels = [
      {
        value: 1,
        permissionName: 'phonebook_level_1',
        label: 'Manage private contacts',
        description: 'Allow editing and deleting private contacts in the company phonebook'
      },
      {
        value: 2,
        permissionName: 'ad_phonebook',
        label: 'Manage public and shared contacts',
        description: 'Allow editing and deleting public and shared contacts in the company phonebook'
      }
    ];

    var phonebookLevelPermissions = {
      0: 'phonebook_level_0',
      1: 'phonebook_level_1',
      2: 'phonebook_level_2',
      3: 'ad_phonebook'
    };
    var phonebookLevelPermissionNames = [
      phonebookLevelPermissions[0],
      phonebookLevelPermissions[1],
      phonebookLevelPermissions[2],
      phonebookLevelPermissions[3]
    ];

    $scope.initGraphics = function () {};

    $scope.isPhonebookAdvancedPermission = function(macro, permission) {
      return macro === 'phonebook' && permission && permission.name === 'ad_phonebook';
    };

    $scope.isPhonebookLevelPermission = function(macro, permission) {
      return macro === 'phonebook' && permission &&
        phonebookLevelPermissionNames.indexOf(permission.name) !== -1;
    };

    $scope.isPhonebookLevelStoragePermission = function(macro, permission) {
      return macro === 'phonebook' && permission && [
        phonebookLevelPermissions[0],
        phonebookLevelPermissions[1],
        phonebookLevelPermissions[2]
      ].indexOf(permission.name) !== -1;
    };

    $scope.getPhonebookPermissionLevel = function(permissions) {
      for (var i = 0; i < permissions.length; i++) {
        if ((permissions[i].name === phonebookLevelPermissions[3] || permissions[i].name === phonebookLevelPermissions[2]) &&
          permissions[i].value === true) {
          return 2;
        }
      }

      for (var j = 0; j < permissions.length; j++) {
        if (permissions[j].name === phonebookLevelPermissions[1] && permissions[j].value === true) {
          return 1;
        }
      }

      for (var k = 0; k < permissions.length; k++) {
        if (permissions[k].name === phonebookLevelPermissions[0] && permissions[k].value === true) {
          return 0;
        }
      }

      return 0;
    };

    $scope.getPhonebookLevelDefinition = function(permissionName) {
      for (var i = 0; i < $scope.phonebookPermissionLevels.length; i++) {
        if ($scope.phonebookPermissionLevels[i].permissionName === permissionName) {
          return $scope.phonebookPermissionLevels[i];
        }
      }

      return null;
    };

    $scope.getPhonebookPermissionDisplayname = function(permission) {
      var definition = $scope.getPhonebookLevelDefinition(permission && permission.name);

      if (definition && definition.label) {
        return definition.label;
      }

      return permission && permission.displayname ? permission.displayname : '';
    };

    $scope.getPhonebookPermissionDescription = function(permission) {
      var definition = $scope.getPhonebookLevelDefinition(permission && permission.name);

      if (definition && definition.description) {
        return definition.description;
      }

      return permission && permission.description ? permission.description : '';
    };

    $scope.getMacroPermissionDescription = function(macro, objPermissions) {
      if (macro === 'phonebook') {
        return 'Allow access to the phonebook. When enabled without the permissions below, users can only search and view contacts in read-only mode';
      }

      return objPermissions && objPermissions.description ? objPermissions.description : '';
    };

    $scope.getPhonebookVisiblePermissions = function(obj_permissions) {
      var permissions = obj_permissions && obj_permissions.permissions;
      var visiblePermissions = [];

      if (!Array.isArray(permissions)) {
        permissions = [];
        if (obj_permissions) {
          obj_permissions.permissions = permissions;
        }
      }

      $scope.ensurePhonebookLevelPermissions(permissions);
      for (var levelIdx = 0; levelIdx < $scope.phonebookPermissionLevels.length; levelIdx++) {
        for (var permissionIdx = 0; permissionIdx < permissions.length; permissionIdx++) {
          if (permissions[permissionIdx].name === $scope.phonebookPermissionLevels[levelIdx].permissionName) {
            visiblePermissions.push(permissions[permissionIdx]);
            break;
          }
        }
      }

      return visiblePermissions;
    };

    $scope.ensurePhonebookLevelPermissions = function(permissions) {
      for (var permissionLevel in phonebookLevelPermissions) {
        var permissionName = phonebookLevelPermissions[permissionLevel];
        var exists = permissions.some(function(permission) {
          return permission.name === permissionName;
        });

        if (!exists) {
          permissions.push({
            id: null,
            name: permissionName,
            displayname: 'Phonebook level ' + permissionLevel,
            description: 'Phonebook level ' + permissionLevel,
            value: false
          });
        }
      }
    };

    $scope.normalizeProfilePhonebookPermissions = function(profile) {
      if (!profile || !profile.macro_permissions || !profile.macro_permissions.phonebook) {
        return;
      }

      var permissions = profile.macro_permissions.phonebook.permissions || [];
      profile.macro_permissions.phonebook.permissions = permissions;
      $scope.ensurePhonebookLevelPermissions(permissions);
      var macroEnabled = profile.macro_permissions.phonebook.value === true;
      var level = $scope.getPhonebookPermissionLevel(permissions);
      for (var permissionIdx = 0; permissionIdx < permissions.length; permissionIdx++) {
        if ($scope.isPhonebookLevelPermission('phonebook', permissions[permissionIdx])) {
          permissions[permissionIdx].level = level;
          permissions[permissionIdx].value =
            (macroEnabled && permissions[permissionIdx].name === phonebookLevelPermissions[0]) ||
            (level === 1 && permissions[permissionIdx].name === phonebookLevelPermissions[1]) ||
            (level === 2 && permissions[permissionIdx].name === phonebookLevelPermissions[2]) ||
            (level === 2 && permissions[permissionIdx].name === phonebookLevelPermissions[3]);
        }
      }
    };

    $scope.savePhonebookPermissionLevel = function(profile, obj_permissions, permission, macro) {
      var permissions = obj_permissions.permissions || [];
      var backupPermissions = angular.copy(permissions);
      var selectedDefinition = $scope.getPhonebookLevelDefinition(permission.name);
      var statusKey = permission.name;

      obj_permissions.permissions = permissions;
      $scope.ensurePhonebookLevelPermissions(permissions);

      if (!selectedDefinition) {
        return;
      }

      var nextLevel = permission.value === true ? selectedDefinition.value : 0;
      var macroEnabled = !!(profile && profile.macro_permissions && profile.macro_permissions.phonebook &&
        profile.macro_permissions.phonebook.value === true);

      for (var permissionIdx = 0; permissionIdx < permissions.length; permissionIdx++) {
        if ($scope.isPhonebookLevelPermission('phonebook', permissions[permissionIdx])) {
          permissions[permissionIdx].value =
            (macroEnabled && permissions[permissionIdx].name === phonebookLevelPermissions[0]) ||
            (nextLevel === 1 && permissions[permissionIdx].name === phonebookLevelPermissions[1]) ||
            (nextLevel === 2 && permissions[permissionIdx].name === phonebookLevelPermissions[2]) ||
            (nextLevel === 2 && permissions[permissionIdx].name === phonebookLevelPermissions[3]);
          permissions[permissionIdx].level = nextLevel;
        }
      }

      profile.onSave = true;
      $scope.phonebookPermissionsStatus[statusKey] = 'loading';

      var onSuccess = function () {
        $scope.normalizeProfilePhonebookPermissions(profile);
        $scope.checkAllGroups();
        profile.onSave = false;
        $scope.onSaveSuccess = true;
        $scope.onSaveError = false;
        $scope.phonebookPermissionsStatus[statusKey] = 'success';
        $timeout(function () {
          delete $scope.phonebookPermissionsStatus[statusKey];
        }, 5000);
      };

      var onError = function () {
        obj_permissions.permissions = backupPermissions;
        if (profile.macro_permissions && profile.macro_permissions.phonebook) {
          profile.macro_permissions.phonebook.permissions = backupPermissions;
        }
        $scope.normalizeProfilePhonebookPermissions(profile);
        profile.onSave = false;
        $scope.onSaveSuccess = false;
        $scope.onSaveError = true;
        $scope.phonebookPermissionsStatus[statusKey] = 'error';
        if(!$scope.$$phase) {
          $scope.$apply();
        }
      };

      if (profile.id) {
        ProfileService.update(profile.id, profile).then(function () {
          onSuccess();
        }, function () {
          onError();
        });
        return;
      }

      ProfileService.create(profile).then(function (res) {
        profile.id = res.id;
        onSuccess();
      }, function () {
        onError();
      });
    };

    $scope.isPhonebookPermissionSaving = function(permission) {
      return $scope.phonebookPermissionsStatus[permission.name] === 'loading';
    };

    $scope.isPhonebookPermissionError = function(permission) {
      return $scope.phonebookPermissionsStatus[permission.name] === 'error';
    };

    $scope.isPhonebookPermissionSuccess = function(permission) {
      return $scope.phonebookPermissionsStatus[permission.name] === 'success';
    };

    $scope.tempBlacklist = ["chat", "video_conference", "trunks"];

    $scope.isInBlacklist = function(perm) {
      return $scope.tempBlacklist.includes(perm) || perm.startsWith('in_queue_');
    }

    $scope.shouldHideGroupPermission = function(obj_permissions, permName) {
      // don't hide if it's not a group permission
      if (!$scope.isGroupPermission(permName)) {
        return false;
      }
      // hide group permission if all_groups permission is active
      const allGroupsPerm = obj_permissions.permissions.find(p => p.name === 'all_groups');
      return allGroupsPerm && allGroupsPerm.value;
    }

    $scope.isGroupPermission = function(p) {
      return p.indexOf("grp_") !== -1;
    };

    $scope.splitGroupName = function(p) {
      return p.split(': ');
    };

    $scope.toPermissionName = function(g) {
      return "grp_" + g;
    }

    $scope.getAllProfiles = function (reload) {
      $scope.view.changeRoute = reload;
      ProfileService.allProfiles().then(function (res) {
        $scope.allProfiles = res.data;
        for (var profileIdx = 0; profileIdx < $scope.allProfiles.length; profileIdx++) {
          $scope.normalizeProfilePhonebookPermissions($scope.allProfiles[profileIdx]);
        }
        $scope.getAllGroups();
        $scope.view.changeRoute = false;
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    };

    $scope.createNewProfile = function (newProfile, macros) {
      newProfile.onSave = true;
      if (newProfile.duplicateProfile) {
        ProfileService.getProfile(newProfile.duplicateProfile.id).then(function (res) {
          var emptyProfile = {
            name: newProfile.name,
            macro_permissions: res.data.macro_permissions,
            outbound_routes_permissions: res.data.outbound_routes_permissions
          }
          ProfileService.create(emptyProfile).then(function (res) {
            newProfile.onSave = false;
            emptyProfile.id = res.id;
            $scope.getAllProfiles(false);
            $scope.onSaveSuccess = true;
            $scope.onSaveError = false;
            $scope.allProfiles.push(emptyProfile);
            $scope.newProfile = {};
            $('#newProfileModal').modal('hide');
          }, function (err) {
            newProfile.onSave = false;
            $scope.onSaveSuccess = false;
            $scope.onSaveError = true;
            console.log(err);
          });
        }, function (err) {
          console.log(err);
        });
      } else {
        ProfileService.allPermissions().then(function (res) {
          var emptyProfile = {
            name: newProfile.name,
            macro_permissions: res.data,
            outbound_routes_permissions: res.data.outbound_routes_permissions
          }
          ProfileService.create(emptyProfile).then(function (res) {
            newProfile.onSave = false;
            emptyProfile.id = res.id;
            $scope.getAllProfiles(false);
            $scope.onSaveSuccess = true;
            $scope.onSaveError = false;
            $scope.allProfiles.push(emptyProfile);
            $scope.newProfile = {};
            $('#newProfileModal').modal('hide');
          }, function (err) {
            newProfile.onSave = false;
            $scope.onSaveSuccess = false;
            $scope.onSaveError = true;
            console.log(err);
          });
        }, function (err) {
          console.log(err);
        });
      }
    };

    $scope.saveProfile = function (profile, obj_permissions, permission, macro) {
      // show queueManager missing license error
      // check if queue manager permission is active and license is not active
      if (macro === 'qmanager' && !$scope.isLicenseActive) {
        $scope.showLicenseError = true;
          $timeout(function() {
            profile.macro_permissions.qmanager.value = false;
        }, 1000);
      }
      // show privacy warning message
      if ((permission !== undefined && permission.name === 'recording' && permission.value) || (permission !== undefined && permission.name === 'spy' && permission.value) || (permission !== undefined && permission.name === 'intrude' && permission.value) || (permission !== undefined && permission.name === 'ad_recording' && permission.value)) {
        $scope.showPrivacyWarning = true;
      }
      //turn off all permissions in macro without the one selected
      if (macro == "operator_panel") {
        for (var p in obj_permissions.permissions) {
          if (permission.id != obj_permissions.permissions[p].id) {
            obj_permissions.permissions[p].value = false;
          }
        }
      }

      if(macro == 'nethvoice_cti') {
        // list all linked permissions
        for (var p in profile.macro_permissions) {
          if (p === 'phonebook' || p === 'cdr' || p  === 'presence_panel' || p === 'customer_card' || p === 'queue_agent' || p === 'streaming' || p === 'off_hour' || p === 'qmanager' || p === 'operator_panel') {
            var m = profile.macro_permissions[p];
            m.value = obj_permissions.value;
          }
        }
      }

      //start saving
      profile.onSave = true;
      if (profile.id) {
        if (permission){
          $scope.permissionsStatus[permission.id] = "loading";
          $scope.outboundStatus[permission.route_id] = "loading";
        }
        ProfileService.update(profile.id, profile).then(function (res) {
          $scope.checkAllGroups();
          profile.onSave = false;
          //$scope.getAllProfiles(false);
          $scope.onSaveSuccess = true;
          $scope.onSaveError = false;
          if (permission){
            $scope.permissionsStatus[permission.id] = "success";
            $scope.outboundStatus[permission.route_id] = "success";
            $timeout(function () {
              delete $scope.permissionsStatus[permission.id];
              delete $scope.outboundStatus[permission.route_id];
            }, 5000)
          }
        }, function (err) {
          if(permission){
            permission.value = !permission.value;
          }
          profile.onSave = false;
          $scope.onSaveSuccess = false;
          $scope.onSaveError = true;
          if(permission){
            $scope.permissionsStatus[permission.id] = "error";
            $scope.outboundStatus[permission.route_id] = "error";
            if(!$scope.$$phase) {
              $scope.$apply();
            }
          }
        });
      } else {
        ProfileService.create(profile).then(function (res) {
          profile.onSave = false;
          profile.id = res.id;
          $scope.getAllProfiles(false);
          $scope.onSaveSuccess = true;
          $scope.onSaveError = false;
        }, function (err) {
          profile.onSave = false;
          $scope.onSaveSuccess = false;
          $scope.onSaveError = true;
          console.log(err);
        });
      }
    };

    $scope.deleteProfile = function (profile) {
      profile.onSave = true;
      ProfileService.delete(profile.id).then(function (res) {
        profile.onSave = false;
        $scope.getAllProfiles(false);
      }, function (err) {
        profile.onSave = false;
        console.log(err);
      });
    };

    $scope.checkDisabledGruops = function (group) {
      for (var profile in $scope.allProfiles) {
        for (var n in $scope.allProfiles[profile].macro_permissions.presence_panel.permissions) {
          var permission = $scope.allProfiles[profile].macro_permissions.presence_panel.permissions[n];
          if (permission.name == $scope.toPermissionName(group.toLowerCase())) {
            if (permission.value == true) {
              return true;
            }
          }
        }
      }
    }

    $scope.checkAllGroups = function () {
      var allGroupsPermissionActive = false;
      for (var profileIdx in $scope.allProfiles) {
        var profile = $scope.allProfiles[profileIdx];
        if (profile.macro_permissions && profile.macro_permissions.presence_panel) {
          var permissions = profile.macro_permissions.presence_panel.permissions;
          for (var permIdx in permissions) {
            var permission = permissions[permIdx];
            if (permission.name === "all_groups" && permission.value === true) {
              allGroupsPermissionActive = true;
              break;
            }
          }
        }
        if (allGroupsPermissionActive) break;
      }
      if (allGroupsPermissionActive) {
        $scope.gruopsDisabled = false;
        return;
      }
      $scope.gruopsDisabled = false;
      for (var group in $scope.allGroups) {
        if ($scope.checkDisabledGruops($scope.allGroups[group].name) != true) {
          $scope.gruopsDisabled = true;
        }
      }
    };

    $scope.getAllGroups = function () {
      ProfileService.allGroups().then(function (res) {
        $scope.allGroups = res.data;
        $scope.checkAllGroups();
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getAllProfiles(true);

    //Retrieve information about user status
    //example subscription not active
    //{
    //  "configured": 7,
    //  "limit": 8,
    //  "configurable": 8
    //}
    $scope.getInformationLicense = function () {
      UserService.statusLicense().then(function (res) {
        $scope.licenseInformation  = res.data
        //if limit is set to false it means that the license is active
        if ($scope.licenseInformation.limit === false) {
          $scope.isLicenseActive = true;
        } else {
          $scope.isLicenseActive = false;
        }
      } , function (err) {
        if (err.status != 404) {
          console.log(err)
        }
      })
    }

    $scope.resetLicenseErrorMessageQueueManager = function () {
      $scope.showLicenseError = false;
    }

    $scope.resetPrivacyMessage = function () {
      $scope.showPrivacyWarning = false;
    }


    $scope.getInformationLicense();
  });
