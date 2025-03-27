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

    $scope.initGraphics = function () {};

    $scope.tempBlacklist = ["conference", "chat", "video_conference", "trunks"];

    $scope.isInBlacklist = function(perm) {
      return $scope.tempBlacklist.includes(perm);
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
  