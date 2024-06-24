'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:InitCtrl
 * @description
 * # InitCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('InitCtrl', function ($scope, $rootScope, $translate, $location, ConfigService, LanguageService, PhoneService, LocalStorageService, LoginService, UserService,
    MigrationService, TrunkService, RouteService, ModelService, GenericPhoneService, ProvGlobalsService, $q, ProvAkuvoxService, ProvFanvilService, ProvGigasetService,
    ProvSangomaService, ProvSnomService, ProvYealinkService, ProvNethesisService) {

    $scope.customConfig = customConfig
    $scope.appConfig = appConfig
    $scope.macVendors = null

    $scope.view = {
      changeRoute: true,
      navbarReadyFirst: false,
      navbarReadySecond: false
    };

    $scope.mode = {
      isLdap: false
    };

    $scope.login = {
      isLogged: false
    };
    $scope.loginUrl = 'views/login.html';
    $scope.modelsUIUrl = 'views/templates/models-ui.html';
    $scope.fileUploadUIUrl = 'views/templates/file-upload.html';
    $scope.defaultsModalUrl = 'views/templates/defaults-modal.html';

    $scope.ldapResDisabled = false

    $scope.wizard = {
      isWizard: true,
      isMigration: false,
      isMigrationView: false,
      usersMigrationDone: false,
      confMigrationDone: false,
      fromMigrationStart: false,
      isMigrationSkip: false,
      config: {},
      stepCount: 1,
      provisioning: ""
    };

    $scope.menuCount = {
      users: 0,
      trunks: 0,
      routesIn: 0,
      routesOut: 0
    };

    $scope.SCROLLPLUS = 20

    $scope.doLogout = function () {
      LoginService.removeCredentials();
      $location.path('/');
      $('#loginTpl').show();
      $scope.login.isLogged = false;
    };

    $scope.copyUrl = function () {
      $scope.copiedUrl = true
      setTimeout(function () {
        $scope.copiedUrl = false
        $scope.$apply()
      }, 1000)
    }

    $scope.copyPassword = function () {
      $scope.copiedPassword = true
      setTimeout(function () {
        $scope.copiedPassword = false
        $scope.$apply()
      }, 1000)
    }

    $scope.isEmpty = function (obj) {
      for (var prop in obj) {
        return false;
      }
      return true;
    }

    $scope.goTo = function (route, exception, external) {
      if (external) {
        window.open(route, '_blank');
      } else if (!$scope.wizard.isWizard || exception) {
        $location.path(route);
      }
    };

    $scope.toggleNavBar = function () {
      if (window.screen.width < 768) {
        if ($('#navbar-left').hasClass('show-mobile-nav')) {
          $('#wizard-step-footer').css('margin-left', '0px');
        } else {
          $('#wizard-step-footer').css('margin-left', '250px');
        }
      } else {
        if (!$('#navbar-left').hasClass('collapsed')) {
          $('#wizard-step-footer').css('margin-left', '76px');
        } else {
          $('#wizard-step-footer').css('margin-left', '250px');
        }
      }
    };

    $scope.getConfig = function () {
      ConfigService.getConfig().then(function (res) {
        $scope.wizard.config = res.data;
        if (res.data.type === 'ldap') {
          $scope.mode.isLdap = true;
        } else {
          $scope.mode.isLdap = false;
        }
      }, function (err) {
        console.log(err);
      });
    };

    $scope.resolveActiveTab = function (type, index) {
      return window.location.hash.split('/')[index] === type;
    };

    $scope.currentStepCount = function () {
      return $scope.wizard.stepCount;
    }

    $scope.languagesArr = LanguageService.getAllLanguages();
    $scope.changeLanguage = function (l) {
      var userLang = '';
      if (l.key == 'default') {
        userLang = navigator.language || navigator.userLanguage;
        userLang = userLang.replace('-', '_').split('_')[0];
        $translate.use(userLang);
      } else {
        userLang = l.key;
        LocalStorageService.set('preferredLanguage', l.key);
        $translate.use(l.key);
      }
      for (var la in $scope.languagesArr) {
        if ($scope.languagesArr[la].key == userLang) {
          $scope.languagesArr[la].check = true;
        } else {
          $scope.languagesArr[la].check = false;
        }
      }
    };

    $scope.goToFullScreen = function () {
      if ($scope.inFullScreen) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
          $scope.inFullScreen = false;
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
          $scope.inFullScreen = false;
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
          $scope.inFullScreen = false;
        }
      } else {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
          $scope.inFullScreen = true;
        } else if (document.documentElement.mozRequestFullScreen) {
          document.documentElement.mozRequestFullScreen();
          $scope.inFullScreen = true;
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
          $scope.inFullScreen = true;
        } else if (document.documentElement.msRequestFullscreen) {
          document.documentElement.msRequestFullscreen();
          $scope.inFullScreen = true;
        }
      }
    };

    $scope.pauseWizard = function () {
      $scope.wizard.isMigrationView = true;
      $scope.wizard.isWizard = false;
    }

    $scope.redirectMigrationAction = function (migrationStatus, isProviderConfigured) {
      // isMigration
      if (isProviderConfigured == 1) {
        if (migrationStatus == "ready") {
          // migration_status isEmpty in db
          $location.path('/migration');
        } else {
          // migration_status !isEmpty in db
          if (migrationStatus == "users") {
            $location.path("/migration/users");
          } else if (migrationStatus == "cdr") {
            $location.path("/migration/report");
          } else {
            var nextMigRoute = migrationConfig.LABEL_INFO[migrationConfig.LABEL_INFO[migrationStatus].next].route;
            $location.path(nextMigRoute);
          }
        }
      } else {
        ConfigService.getWizard().then(function (res) {
          if (res.length == 0) {
            var isWizard = true;
          } else {
            var isWizard = res[0].status === 'true';
          }
          if (isWizard) {
            // isWizard
            var location = appConfig.STEP_MAP_REVERSE[$scope.wizard.stepCount];
            $location.path('/' + location);
          } else {
            // !isWizard
            $location.path('/');
          }
        }, function (err) {
          console.log(err);
        });
      }
    }

    $scope.redirectOnMigrationStatus = function (migrationStatus) {
      MigrationService.isMigration().then(function (resIsMigration) {
        var isMigration = resIsMigration.data;
        if (isMigration) {
          // isMigration
          ConfigService.getConfig().then(function (resProviderConfig) {
            var isProviderConfigured = resProviderConfig.data.configured;
            if (migrationStatus) {
              // migrationStatus
              $scope.redirectMigrationAction(migrationStatus, isProviderConfigured);
            } else {
              // !migrationStatus
              MigrationService.getMigrationStatus().then(function (migStatus) {
                $scope.redirectMigrationAction(migStatus.data, isProviderConfigured);
              }, function (err) {
                console.log(err);
              });
            }
          }, function (err) {
            console.log(err);
          });
        } else {
          // !isMigration
          $location.path('/');
        }
      }, function (err) {
        console.log(err);
      });
    }

    $scope.exitMigration = function () {
      MigrationService.endMigration().then(function (res) {
        $scope.wizard.isWizard = true;
        $scope.wizard.isMigrationView = false;
        $location.path('/extensions');
      }, function (err) {
        console.log(err);
      });
    }

    $scope.currentYear = function () {
      return new Date().getFullYear();
    }

    $scope.toggleMig = function (id) {
      $("#" + id).slideToggle("fast");
    }

    $scope.slideDown = function (id) {
      $("#" + id).slideDown("fast");
    }

    $scope.slideUp = function (id) {
      $("#" + id).slideDown("fast");
    }

    $scope.showModal = function (id) {
      $("#" + id).modal("show")
    }
    
    $scope.hideModal = function (id) {
      $("#" + id).modal("hide")
    }

    $scope.validateLocation = function () {
      if ($scope.wizard.provisioning != "tancredi") {
        switch ($location.path()) {
          case "/devices/inventory":
            $location.path('/')
            break
          case "/devices/models":
            $location.path('/')
            break
          case "/configurations/preferences":
            $location.path('/')
            break
          case "/apps/bulkdevices":
            $location.path('/')
            break
          default:
            break
        }
      } else {
        switch ($location.path()) {
          case "/users/devices":
            $location.path('/')
            break
          case "/configurations/preferencesFreepbx":
            $location.path('/')
            break
          default:
            break
        }
      }
    }

    var appConfigAdapt = function () {
      if ($scope.wizard.provisioning != "tancredi") {
        appConfig = appConfig_OLD
        $scope.appConfig = appConfig_OLD
      }
    }

    var getProvisioningInfo = function () {
      ConfigService.getProvisioningInfo().then(function (res) {
        $scope.wizard.provisioning = res.data
        appConfigAdapt()
        $scope.validateLocation()
        $scope.view.navbarReadySecond = true
      }, function (err) {
        console.log(err)
      })
    }

    // set language
    $scope.changeLanguage({
      key: LocalStorageService.get('preferredLanguage') || 'default'
    });

    // get count data
    $scope.$on('loginCompleted', function (event, args) {
      // users
      UserService.list(true).then(function (res) {
        $scope.menuCount.users = res.data.length;
      }, function (err) {
        console.log(err);
      });

      //trunks
      TrunkService.count().then(function (res) {
        $scope.menuCount.trunks = res.data;
      }, function (err) {
        console.log(err);
      });

      //routes
      RouteService.countIn().then(function (res) {
        $scope.menuCount.routesIn = res.data;
      }, function (err) {
        console.log(err);
      });
      RouteService.countOut().then(function (res) {
        $scope.menuCount.routesOut = res.data;
      }, function (err) {
        console.log(err);
      }); 

      //config
      $scope.getConfig();
      //provisioning
      getProvisioningInfo()

      $('body').css('background', '');
    });

    $scope.destroyAllSelects = function (parent, container) {
      if (container) {
        $(parent + " #" + container + " .selectpicker").each(function( index, elem ) {
          $(elem).selectpicker("destroy")
          $(elem).remove()
        })
        $(parent + " #" + container + " .combobox").each(function( index, elem ) {
          $(elem).remove()
        })
        $(parent + " #" + container + ".combobox-container").each(function( index, elem ) {
          $(elem).remove()
        })
      } else {
        $(parent + " .selectpicker").each(function( index, elem ) {
          $(elem).selectpicker("destroy")
          $(elem).remove()
        })
        $(parent + " .combobox").each(function( index, elem ) {
          $(elem).remove()
        })
        $(parent + " .combobox-container").each(function( index, elem ) {
          $(elem).remove()
        })
      }
    }

    $rootScope.$on('comboboxRepeatEnd', function(event, elem) {
      elem.parent().combobox().parent().removeClass("hidden")
    })

    $rootScope.$on('selectpickerRepeatEnd', function(event, elem) {
      elem.parent().selectpicker().parent().parent().removeClass("hidden")
    })

    $rootScope.$on('comboboxRepeatEndRevised', function(event, id) {
      $("#" + id).combobox().parent().removeClass("hidden")
    })

    $rootScope.$on('selectpickerRepeatEndRevised', function(event, id) {
      $("#" + id).selectpicker().parent().parent().removeClass("hidden")
    })
 
    // provisining build models start

    $scope.currentModel = {}

    $scope.buildDefaultSettingsUI = function () {
      return {
        pinned: ProvGlobalsService.pinned(),
        preferences: ProvGlobalsService.preferences(),
        phonebook: ProvGlobalsService.phonebook()
      }
    }

    var buildModelUI = function (service, variables) {
      let map = GenericPhoneService.map(variables)
      return {
        map: map,
        softKeys: convertKeysMap(service.softKeys(map)),
        lineKeys: convertKeysMap(service.lineKeys(map)),
        expansionKeys: convertKeysMap(service.expansionKeys(map)),
        displayAndRingtones: service.displayAndRingtones(map),
        preferences: service.preferences(map),
        phonebook: service.phonebook(map),
        network: service.network(map)
      }
    }

    var getModelUI = function (brand, variables) {
      switch (brand.toLowerCase()) {
        case "akuvox":
          return buildModelUI(ProvAkuvoxService, variables)
          break;

        case "fanvil":
          return buildModelUI(ProvFanvilService, variables)
          break;
      
        case "gigaset":
          return buildModelUI(ProvGigasetService, variables)
          break;
      
        case "nethesis":
          return buildModelUI(ProvNethesisService, variables)
          break;

        case "sangoma":
          return buildModelUI(ProvSangomaService, variables)
          break;
          
        case "snom":
          return buildModelUI(ProvSnomService, variables)
          break;

        case "yealink":
          return buildModelUI(ProvYealinkService, variables)
          break;

        default:
          return buildModelUI(GenericPhoneService, variables)
          break;
      }
    }

    var buildModelObj = function (location, name, modelBrand, res) {
      return $scope.currentModel = {
        "uiLocation": location,
        "ui": getModelUI(modelBrand, res.data.variables),
        "storedVariables": angular.copy(res.data.variables),
        "variables": angular.copy(res.data.variables),
        "inputs": angular.copy(res.data.variables),
        "modelVariables": angular.copy(res.data.variables),
        "singleVariables": {},
        "globals": {},
        "name": name,
        "mac": "",
        "display_name" : res.data.display_name,
        "openedSection": "",
        "shownPasswords": {},
        "openedExpKeys": "",
        "showingKeys": "",
        "showingExpKeys": "",
        "changed": false,
        "hasOriginals": hasOriginalsFromName(name),
        "changePhonebookType": false,
        "hidden": false
      }
    }

    $scope.buildModel = function (name, location) {
      return $q(function (resolve, reject) {
        var nameSplit = name.split("-"),
            modelBrand = nameSplit[0].toLowerCase()
        ModelService.getModel(name).then(function (res) {
          buildModelObj(location, name, modelBrand, res)
          getGlobals().then(function (res) {
            resolve(res)
          }, function (err) {
            reject(err)
          })
        }, function () {
          reject(err)
        })
      })
    }

    $scope.enableNextDisabled = function () {
      $scope.wizard.isNextDisabled = false
    }

    $scope.formatBytes = function (bytes, decimals = 2) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    $scope.connectivityCheck = function (obj) {
      ModelService.checkConnectivity(obj).then(function (res) {
        $scope.connectivityCheckRes = res.data
        setTimeout(function () {
          $scope.$apply()
        }, 100)
      }, function (err) {
        console.log(err);
      })
    }

    $scope.refreshGlobalsSelects = function () {
      $('.globalsSectionContainer select').each(function() {
        if ($(this).hasClass("selectpicker")) {
          $(this).selectpicker('refresh')
        } else if ($(this).hasClass("combobox")) {
          $(this).combobox("refresh")
        }
      })
    }

    $scope.loadingDefaults = function () {
      $scope.defaultsLoading = true
      setTimeout(function () {
        $scope.$apply(function () {
          $scope.defaultsLoading = false
        })
      }, 1500)
    }

    $scope.ldapToDefaultVariables = function (res, ldaps, firstTime) {
      let next = !firstTime ? true : firstTime && $scope.defaultSettings["ui_first_config"] ? true : false
      if (ldaps && next) {
        $scope.defaultSettings.ldap_port = res["ldaps"].port
        $scope.defaultSettings.ldap_user = res["ldaps"].user
        $scope.defaultSettings.ldap_password = res["ldaps"].password
        $scope.defaultSettings.ldap_tls = res["ldaps"].tls
        $scope.defaultSettings.ldap_base = res["ldaps"].base
        $scope.defaultSettings.ldap_name_display = res["ldaps"].name_display
        $scope.defaultSettings.ldap_mainphone_number_attr = res["ldaps"].mainphone_number_attr
        $scope.defaultSettings.ldap_mobilephone_number_attr = res["ldaps"].mobilephone_number_attr
        $scope.defaultSettings.ldap_otherphone_number_attr = res["ldaps"].otherphone_number_attr
        $scope.defaultSettings.ldap_name_attr = res["ldaps"].name_attr
        $scope.defaultSettings.ldap_number_filter = res["ldaps"].number_filter
        $scope.defaultSettings.ldap_name_filter = res["ldaps"].name_filter
        $scope.defaultSettings.ldap_server = ""
      } else if (next) {
        $scope.defaultSettings.ldap_port = res["ldap"].port
        $scope.defaultSettings.ldap_user = res["ldap"].user
        $scope.defaultSettings.ldap_password = res["ldap"].password
        $scope.defaultSettings.ldap_tls = res["ldap"].tls
        $scope.defaultSettings.ldap_base = res["ldap"].base
        $scope.defaultSettings.ldap_name_display = res["ldap"].name_display
        $scope.defaultSettings.ldap_mainphone_number_attr = res["ldap"].mainphone_number_attr
        $scope.defaultSettings.ldap_mobilephone_number_attr = res["ldap"].mobilephone_number_attr
        $scope.defaultSettings.ldap_otherphone_number_attr = res["ldap"].otherphone_number_attr
        $scope.defaultSettings.ldap_otherphone_number_attr = res["ldap"].otherphone_number_attr
        $scope.defaultSettings.ldap_name_attr = res["ldap"].name_attr
        $scope.defaultSettings.ldap_number_filter = res["ldap"].number_filter
        $scope.defaultSettings.ldap_name_filter = res["ldap"].name_filter
        $scope.defaultSettings.ldap_server = ""
      }
    }

    /* Get ldap informations from the server. */
    $scope.ldapCheck = function () {
      ModelService.ldapCheck().then(function (res) {
        $scope.ldapCheckRes = res.data
        if (res.data["ldaps"].enabled) {
          $scope.ldapToDefaultVariables(res.data, true, true)
        } else if (res.data["ldap"].enabled) {
          $scope.ldapToDefaultVariables(res.data, false, true)
        } else {
          $scope.ldapResDisabled = true
          if ($scope.defaultSettings.provisioning_url_scheme == "https") {
            $scope.ldapToDefaultVariables(res.data, true, true)
          } else {
            $scope.ldapToDefaultVariables(res.data, false, true)
          }
        }
        $scope.ldapTypeCheck()
        $scope.refreshGlobalsSelects()
      }, function (err) {
        console.log(err);
      })
    }

    $scope.startPhonebookService = function () {
      if ($scope.phonebookType == "ldaps" && !$scope.ldapCheckRes["ldaps"].enabled) {
        // enable phonebookjss
        ConfigService.switchPhonebookJss("enabled").then(function (res) {
          // res phonebookjss
          $scope.ldapResDisabled = false
          $scope.ldapCheckRes["ldaps"].enabled = true
        }, function (err) {
          console.log(err)
        })
      } else if ($scope.phonebookType == "ldap" && !$scope.ldapCheckRes["ldap"].enabled) {
        // enable phonebookjs
        ConfigService.switchPhonebookJs("enabled").then(function (res) {
          // res phonebookjs
          $scope.ldapResDisabled = false
          $scope.ldapCheckRes["ldap"].enabled = true
        }, function (err) {
          console.log(err)
        })
      }
    }

    $scope.ldapTypeCheck = function () {
      if ($scope.defaultSettings["ui_first_config"]) {
        if ($scope.defaultSettings.provisioning_url_scheme == "https") {
          $scope.phonebookType = "ldaps"
        } else {
          $scope.phonebookType = "ldap"
        }
      } else {
        if ($scope.defaultSettings["ldap_server"] == "" && ($scope.defaultSettings["ldap_port"] == $scope.ldapCheckRes.ldap.port)) {
          $scope.phonebookType = "ldap"
        } else if ($scope.defaultSettings["ldap_server"] == "" && ($scope.defaultSettings["ldap_port"] == $scope.ldapCheckRes.ldaps.port)) {
          $scope.phonebookType = "ldaps"
        } else if ($scope.defaultSettings["ldap_server"] != "") {
          $scope.phonebookType = "externalldap"
        }
      }
      setTimeout(function () {
        // update ldap type select
        let typeSelect = document.querySelector("#phonebookType")
        if (typeSelect) {
          typeSelect.value = $scope.phonebookType
          $scope.$apply()
          $(typeSelect).selectpicker("refresh")
        }
        typeSelect = null
      }, 100)
    }

    var modelLdapTypeApply = function () {
      if (($scope.currentModel.globals["ldap_server"] == "" && $scope.currentModel.variables["ldap_server"] == "") && ($scope.currentModel.globals["ldap_port"] == $scope.ldapCheckRes.ldap.port || $scope.currentModel.variables["ldap_port"] == $scope.ldapCheckRes.ldap.port)) {
        $scope.modelPhonebookType = "ldap"
      } else if (($scope.currentModel.globals["ldap_server"] == "" && $scope.currentModel.variables["ldap_server"] == "") && ($scope.currentModel.globals["ldap_port"] == $scope.ldapCheckRes.ldaps.port || $scope.currentModel.variables["ldap_port"] == $scope.ldapCheckRes.ldaps.port)) {
        $scope.modelPhonebookType = "ldaps"
      } else if ($scope.currentModel.globals["ldap_server"] == "" || $scope.currentModel.variables["ldap_server"] == "") {
        $scope.modelPhonebookType = "externalldap"
      }
    }

    $scope.modelLdapTypeCheck = function () {
      if ($scope.ldapCheckRes) {
        modelLdapTypeApply()
      } else {
        ModelService.ldapCheck().then(function (res) {
          $scope.ldapCheckRes = res.data
          modelLdapTypeApply()
        }, function (err) {
          console.log(err)
        })
      }
    }

    $scope.toInt = function (string) {
      return parseInt(string)
    }

    $scope.uploads = {
      "firmware_file": [],
      "ringtones_file": [],
      "background_file": [],
      "screensaver_file": []
    }

    // get firmwares for firmware file upload
    $scope.getFirmwares = function () {
      ModelService.getFirmwares().then(function (res) {
        $scope.uploads.firmware_file = res.data
        for (let firm in $scope.uploads.firmware_file) {
          $scope.uploads.firmware_file[firm].size = $scope.formatBytes($scope.uploads.firmware_file[firm].size)
        }
      }, function (err) {
        console.log(err)
      })
    }

    // reload firmwares for firmware file upload
    $scope.reloadFirmwaresList = function () {
      ModelService.getFirmwares().then(function (res) {
        $scope.uploads.firmware_file = res.data
        for (let firm in $scope.uploads.firmware_file) {
          $scope.uploads.firmware_file[firm].size = $scope.formatBytes($scope.uploads.firmware_file[firm].size)
        }
        setTimeout(function () {
          $scope.$apply()
          $(".model-container .firmware_file-select").selectpicker("refresh")
        }, 100)
      }, function (err) {
        console.log(err)
      })
    }

    // get ringtones for ringotne file upload
    $scope.getRingtones = function () {
      ModelService.getRingtone().then(function (res) {
        $scope.uploads.ringtone_file = res.data
        for (let ring in $scope.uploads.ringtone_file) {
          $scope.uploads.ringtone_file[ring].size = $scope.formatBytes($scope.uploads.ringtone_file[ring].size)
        }
      }, function (err) {
        console.log(err)
      })
    }

    // reload ringtones for ringtone file upload
    $scope.reloadRingtonesList = function () {
      ModelService.getRingtone().then(function (res) {
        $scope.uploads.ringtone_file = res.data
        for (let ring in $scope.uploads.ringtone_file) {
          $scope.uploads.ringtone_file[ring].size = $scope.formatBytes($scope.uploads.ringtone_file[ring].size)
        }
        setTimeout(function () {
          $scope.$apply()
          $(".model-container .ringtone_file-select").selectpicker("refresh")
        }, 100)
      }, function (err) {
        console.log(err)
      })
    }

    // get backgrounds for background file upload
    $scope.getBackgrounds = function () {
      ModelService.getBackground().then(function (res) {
        $scope.uploads.background_file = res.data
        for (let ring in $scope.uploads.background_file) {
          $scope.uploads.background_file[ring].size = $scope.formatBytes($scope.uploads.background_file[ring].size)
        }
      }, function (err) {
        console.log(err)
      })
    }

    // reload background for background file upload
    $scope.reloadBackgroundsList = function () {
      ModelService.getBackground().then(function (res) {
        $scope.uploads.background_file = res.data
        for (let ring in $scope.uploads.background_file) {
          $scope.uploads.background_file[ring].size = $scope.formatBytes($scope.uploads.background_file[ring].size)
        }
        setTimeout(function () {
          $scope.$apply()
          $(".model-container .background_file-select").selectpicker("refresh")
        }, 100)
      }, function (err) {
        console.log(err)
      })
    }

    // get screensavers for screensaver file upload
    $scope.getScreensavers = function () {
      ModelService.getScreensaver().then(function (res) {
        $scope.uploads.screensaver_file = res.data
        for (let screen in $scope.uploads.screensaver_file) {
          $scope.uploads.screensaver_file[screen].size = $scope.formatBytes($scope.uploads.screensaver_file[screen].size)
        }
      }, function (err) {
        console.log(err)
      })
    }

    // reload screensavers for background file upload
    $scope.reloadScreensaversList = function () {
      ModelService.getScreensaver().then(function (res) {
        $scope.uploads.screensaver_file = res.data
        for (let screen in $scope.uploads.screensaver_file) {
          $scope.uploads.screensaver_file[screen].size = $scope.formatBytes($scope.uploads.screensaver_file[screen].size)
        }
        setTimeout(function () {
          $scope.$apply()
          $(".model-container .screensaver_file-select").selectpicker("refresh")
        }, 100)
      }, function (err) {
        console.log(err)
      })
    }

    $scope.scrollingContainerView = function () {
      $rootScope.$broadcast("scrollingContainerView")
    }
    
    var getGlobals = function () {
      return $q(function (resolve, reject) {
        ModelService.getDefaults().then(function (res) {
          $scope.currentModel.globals = angular.copy(res.data)
          for (var globalVariables in res.data) {
            if (!$scope.currentModel.variables[globalVariables]) {
              $scope.currentModel.variables[globalVariables] = angular.copy(res.data[globalVariables])
            }
            resolve(res)
          }
        }, function (err) {
          reject(err)
        })
      })
    }

    var hasOriginalsFromName = function (name) {
      return (name.split("-").length)-1 == 1 ? true : false
    }

    var convertKeysMap = function (keys) {
      // convert keys intervals to a flat list of key numbers
      if (keys) {
        var keysIntervals = keys.items[0].keys.intervals;
        var indexes = [];
        keysIntervals.forEach(function (interval) {
          for (var i = interval.start; i <= interval.end; i++) {
            indexes.push(i);
          }
        });
        keys.items[0].keysIndexes = indexes;
        return keys;
      }
    }

    $scope.$on('curentModelSaved', function() { 
      $scope.currentModel.changed = false
    })

    $scope.$on('variableChanged', function() { 
      if (!$scope.currentModel.changed) {
        $scope.currentModel.changed = true
      }
    })

    $scope.$on('$routeChangeStart', function() {
      if ($location.path() == '/devices/models'){
        $scope.currentModel = {}
        $scope.destroyAllSelects("#modelsContainer")
      }
      if ($location.path() == '/configurations') {
        $scope.currentModel = {}
        $scope.destroyAllSelects("#singleModelModal")
      }
      if ($location.path() == '/devices/models' || $location.path() == '/devices'){
        $scope.defaultSettings = {}
      }
      if ($scope.connectivityCheckRes) {
        $scope.connectivityCheckRes = null
      }
      if ($scope.ldapResDisabled) {
        $scope.ldapResDisabled = false
      }
    })

    document.body.addEventListener('click', function (evt) {
      $rootScope.$broadcast("domclick", evt)
    }, true);

  });
