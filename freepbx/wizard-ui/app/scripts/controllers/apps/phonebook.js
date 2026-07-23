'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:PhonebookCtrl
 * @description
 * # PhonebookCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('PhonebookCtrl', function ($scope, ApplicationService, PhonebookService, ProfileService, UserService) {

    // set variables
    $scope.sourcePortMap = {
      "mssql:7_1": '1433',
      "mssql:7_2": '1433',
      "mssql:7_3_A": '1433',
      "mssql:7_3_B": '1433',
      "mssql:7_4": '1433',
      "mysql": '3306',
      "postgres": '5432'
    };

    $scope.phonebookIcons = {
      "homeemail": {
        "icon": "envelope",
        "label": "Email"
      },
      "workemail": {
        "icon": "envelope",
        "label": "Email"
      },
      "homephone": {
        "icon": "phone",
        "label": "Home phone"
      },
      "workphone": {
        "icon": "phone",
        "label": "Work phone"
      },
      "cellphone": {
        "icon": "mobile",
        "label": "Cell phone"
      },
      "fax": {
        "icon": "fax",
        "label": "Fax"
      },
      "title": {
        "icon": "graduation-cap",
        "label": "Job title"
      },
      "company": {
        "icon": "building",
        "label": "Company"
      },
      "notes": {
        "icon": "file",
        "label": "Notes"
      },
      "homelocation": {
        "icon": "marker",
        "label": "Location"
      },
      "worklocation": {
        "icon": "marker",
        "label": "Location"
      },
      "url": {
        "icon": "world",
        "label": "Site"
      },
      "name": {
        "icon": "user",
        "label": "Name"
      },
      "firstname": {
        "icon": "user",
        "label": "First name"
      },
      "lastname": {
        "icon": "user",
        "label": "Last name"
      },
      "job": {
        "icon": "briefcase",
        "label": "Job"
      },
      "workphone2": {
        "icon": "phone",
        "label": "Work phone"
      },
      "cellphone2": {
        "icon": "mobile",
        "label": "Cell phone"
      },
      "otherphone": {
        "icon": "phone",
        "label": "Other telephone number"
      },
      "otheremail": {
        "icon": "envelope",
        "label": "Other email address"
      },
      "facebook": {
        "icon": "facebook",
        "label": "Facebook"
      },
      "instagram": {
        "icon": "instagram",
        "label": "Instagram"
      },
      "linkedin": {
        "icon": "linkedin",
        "label": "LinkedIn"
      }
    }

    $scope.allDBTypes = {
      "mysql": "MySQL",
      "csv": "CSV",
      "csv_cti": "CSV (CTI phonebook)",
      "infinity": "Infinity Zucchetti"
    };

    // Source types that write into the personal CTI phonebook (cti_phonebook)
    // instead of the centralized one. They carry an owner and are imported
    // one-shot through the middleware rather than synced on a schedule.
    $scope.ctiPhonebookTypes = ['csv_cti'];

    $scope.isCtiPhonebookType = function (dbtype) {
      return $scope.ctiPhonebookTypes.indexOf(dbtype) !== -1;
    };

    // Fixed, read-only field mapping applied by the importer for Infinity sources.
    $scope.infinityMapping = [
      { source: "Name", dest: "name" },
      { source: "Company", dest: "company" },
      { source: "Mobile phone", dest: "cellphone" },
      { source: "Work phone", dest: "workphone" },
      { source: "Home phone", dest: "homephone" },
      { source: "Fax", dest: "fax" },
      { source: "Work email", dest: "workemail" },
      { source: "Home email", dest: "homeemail" },
      { source: "Address", dest: "workstreet" },
      { source: "Office", dest: "title" },
      { source: "Office / status / id", dest: "notes" }
    ];

    $scope.syncIntervals = {
      "15": "15 minutes",
      "30": "30 minutes",
      "60": "1 hour",
      "360": "6 hours",
      "1440": "24 hours"
    }

    $scope.sourceModal = {
      tab: "datasource",
      querySelectDone: false,
      querySelectProgress: false
    };

    $scope.querySelect = [];

    $scope.ui = {
      onModify: false
    }

    $scope.newSource = {
      mapping: {}
    };

    $scope.sharing = {
      mode: 'public',
      groups: []
    };

    $scope.allSources = {};
    $scope.allSourcesList = [];
    $scope.colsSources = {};
    $scope.colsDestinations = {};
    $scope.allGroups = [];
    // CTI users, used as the owner picker for CSV sources.
    $scope.ctiUsers = [];

    $scope.view.changeRoute = true;

    $scope.getAllGroups = function () {
      ProfileService.allGroups().then(function (res) {
        $scope.allGroups = angular.isArray(res.data) ? res.data : [];
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getCtiUsers = function () {
      UserService.list(false).then(function (res) {
        var users = angular.isArray(res.data) ? res.data : [];
        // The owner must be a configured user (one with an extension), like the Users page shows.
        // The list is filtered here client-side because the backend returns every user.
        $scope.ctiUsers = users.filter(function (u) {
          return u.default_extension && u.default_extension !== 'none';
        });
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getSourceName = function (pbo, defval) {
      return pbo.type || pbo.dbname || pbo._sourceKey || defval;
    };

    $scope.buildSharingType = function () {
      if ($scope.sharing.mode === 'group' && $scope.sharing.groups.length) {
        return 'group:' + $scope.sharing.groups.join(',');
      }
      return 'public';
    };

    $scope.applySharingFromAccess = function (access) {
      if (typeof access === 'string' && access.indexOf('group:') === 0) {
        $scope.sharing.mode = 'group';
        $scope.sharing.groups = access.slice(6).split(',').filter(function (g) { return g !== ''; });
      } else {
        $scope.sharing.mode = 'public';
        $scope.sharing.groups = [];
      }
    };

    $scope.getSourceType = function (pbo, defval) {
      return $scope.allDBTypes[pbo.dbtype] ? $scope.allDBTypes[pbo.dbtype] : defval;
    };

    $scope.normalizeSources = function (sources) {
      $scope.allSources = angular.isObject(sources) ? sources : {};
      $scope.allSourcesList = Object.keys($scope.allSources).map(function (key) {
        var source = $scope.allSources[key] || {};
        source._sourceKey = key;
        return source;
      });
    };

    // rest api functions
    $scope.getAllSources = function () {
      PhonebookService.readConfig().then(function (res) {
        $scope.normalizeSources(res.data);
        $scope.view.changeRoute = false;
      }, function (err) {
        console.log(err);
      });
    }

    $scope.getDestColumns = function () {
      PhonebookService.readFields().then(function (res) {
        for (var c in res.data) {
          $scope.colsDestinations[res.data[c]] = {
            inuse: false
          }  
        }
      }, function (err) {
        console.log(err);
      });
    }

    $scope.getSourceColumns = function (obj, source) {
      $scope.colsSources = {};
      for (var c in obj) {
        $scope.colsSources[c] = {
          inuse: false
        }
      }
      source.sourceColumns = $scope.colsSources;
    }

    // view functions
    $scope.csvUploadClick = function (ev) {
      $('#csvUploadFile').one("change", function(ev) {
        try {
          PhonebookService.uploadFile(event.target.files[0]).then((res) => {
            if(!res.data.uri || !res.data.uri.startsWith('file:///')) {
              throw 'Response uri field is missing or malformed';
            }
            $scope.newSource.url = res.data.uri;
            setTimeout(() => {
              $('#pbSourceCheckButton').click();
            });
          });
        } catch (err) {
          console.error('File upload error!', err);
        }
      }).click();
    };

    $scope.togglePass = function (g) {
      g.showPass = !g.showPass;
    };

    $scope.enableSourceSave = function (source, destination) {
      $scope.enableSourceSaveVal = true;
      $scope.newSource.mapping[source] = destination;
      $scope.reloadAvailableDestinations();
    };

    $scope.disassociatesColumn = function (colSource, colDest) {
        $scope.colsDestinations[colDest].inuse = false;
        delete $scope.newSource.mapping[colSource];
        $scope.reloadAvailableDestinations();
    }

    $scope.reloadAvailableDestinations = function () {
      for (var column in $scope.colsDestinations) {
        for (var map in $scope.newSource.mapping) {
          if ($scope.newSource.mapping[map] === column) {
            $scope.colsDestinations[column].inuse = true;
            break;
          } else {
            $scope.colsDestinations[column].inuse = false; 
          }
        }
      }
    }

    $scope.modifySource = function (kg, g) {
      $scope.ui.onModify = true;
      $scope.ui.modifyId = kg;
      $scope.newSource = g;
      $scope.colsSources = g.sourceColumns;
      $scope.applySharingFromAccess(g.access);
      setTimeout(function () {
        $scope.checkConnection(g);
      }, 500);
    }

    $scope.newSourceEvent = function () {
      $scope.ui.onModify = false;
      $scope.switchsourceModalTab("datasource");
      $scope.querySelect = [];
      $scope.sharing = { mode: 'public', groups: [] };
      $scope.newSource = {
        query: "SELECT * FROM [table]",
        dbtype: "mysql",
        interval: "1440",
        port: $scope.sourcePortMap.mysql,
        mapping: {},
        enabled: true
      }
      $scope.reloadAvailableDestinations();
    }

    var createSourcePayload = function(s) {
      var payload = {};
      if (s.dbtype == 'mysql') {
        payload = {
          dbtype: 'mysql',
          dbname: s.dbname,
          host: s.host,
          port: s.port,
          user: s.user,
          password: s.password,
          query: s.query,
        };
      } else if (s.dbtype == 'csv' || s.dbtype == 'csv_cti') {
        // csv_cti shares the CSV file format: the same test/preview path is used to
        // read the source columns. The actual import target (centralized vs CTI
        // phonebook) is decided at save time, not here.
        payload = {
          dbtype: 'csv',
          url: s.url,
        };
      } else if (s.dbtype == 'infinity') {
        // Zucchetti Infinity API source: fixed field mapping is applied by the
        // importer, so only the API credentials are configured here.
        payload = {
          dbtype: 'infinity',
          url: s.url,
          username: s.username,
          password: s.password,
        };
      }
      // type = free-text source name (card title, phonebook `type` column);
      // access = sharing scope (public/group), enforced by the middleware.
      payload.type = s.type;
      payload.access = $scope.buildSharingType();
      payload.mapping = s.mapping;
      payload.enabled = s.enabled;
      payload.interval = s.interval;
      return payload;
    };

    $scope.isSharingValid = function () {
      return $scope.sharing.mode !== 'group' || $scope.sharing.groups.length > 0;
    };

    var createCtiImportPayload = function (s) {
      return {
        url: s.url,
        owner: s.owner || '',
        type: $scope.buildSharingType(),
        mapping: s.mapping
      };
    };

    $scope.isCtiImportValid = function () {
      return $scope.isSharingValid() && !!($scope.newSource && $scope.newSource.owner);
    };

    $scope.saveSource = function () {
      if ($scope.isCtiPhonebookType($scope.newSource.dbtype)) {
        // One-shot import into the personal CTI phonebook through the middleware.
        // No recurring source is stored: an owner is required and the contacts are
        // appended once.
        if (!$scope.isCtiImportValid()) {
          $scope.onSaveErrorSource = true;
          return;
        }
        $scope.importResult = null;
        PhonebookService.importCti(createCtiImportPayload($scope.newSource)).then(function (res) {
          $("#creationsourceModal").modal('hide');
          $scope.onSaveSuccessSource = true;
          $scope.importResult = res.data;
          $scope.ui.onModify = false;
        }, function (err) {
          $scope.onSaveErrorSource = true;
          $scope.importResult = err && err.data ? err.data : null;
          console.log(err);
        });
        return;
      }
      if (!$scope.isSharingValid()) {
        $scope.onSaveErrorSource = true;
        return;
      }
      PhonebookService.createConfig(createSourcePayload($scope.newSource)).then(function (res) {
        $("#creationsourceModal").modal('hide');
        $scope.onSaveSuccessSource = true;
        $scope.ui.onModify = false;
        $scope.getAllSources();
      }, function (err) {
        $scope.onSaveErrorSource = true;
        console.log(err);
      });
    }

    $scope.updateSource = function (fromSwitch) {
      if (!fromSwitch && !$scope.isSharingValid()) {
        $scope.onSaveErrorSource = true;
        return;
      }
      PhonebookService.updateConfig($scope.ui.modifyId, createSourcePayload($scope.newSource)).then(function (res) {
        if (!fromSwitch) {
          $("#creationsourceModal").modal('hide');
          $scope.getAllSources();
        } 
      }, function (err) {
        console.log(err);
      });
    }

    $scope.runSyncNow = function (id) {
      $scope.allSources[id].syncing = true;
      PhonebookService.syncNow(id).then(function (res) {
        $scope.allSources[id].syncing = false;
        $scope.allSources[id].startSync = true;
        if (res.data.status) {
          $scope.allSources[id].synced = true;
        } else {
          $scope.allSources[id].synced = false;
        }
      }, function (err) {
        console.log(err);
      });
    }

    $scope.switchsourceModalTab = function (tab) {
      $scope.sourceModal.tab = tab;
    }

    $scope.openDeleteModal = function (kg) {
      $scope.ui.deleteId = kg;
      $("#deleteModal").modal('show');
    }

    $scope.onOfSource = function (ks, s) {
      $scope.ui.modifyId = ks;
      $scope.newSource = s;
      $scope.applySharingFromAccess(s.access);
      $scope.updateSource(true);
    }

    $scope.updateDbType = function () {
      if ($scope.newSource.dbtype == 'mysql') {
        $scope.newSource.port = $scope.sourcePortMap[$scope.newSource.dbtype];
      } else {
        delete $scope.newSource.port;
      }
    };

    $scope.deletePhonebookSource = function () {
      PhonebookService.deleteConfig($scope.ui.deleteId).then(function (res) {
        $("#deleteModal").modal('hide');
        $scope.getAllSources();
      }, function (err) {
        console.log(err);
      });
    }

    $scope.checkConnection = function (s) {
      var payload = createSourcePayload(s);
      s.isChecking = true;
      $scope.sourceModal.querySelectProgress = true;
      PhonebookService.testConnections(payload).then(function (res) {
        $scope.sourceModal.querySelectProgress = false;
        if (res.data.status != false) {
          s.checked = true;
          s.isChecking = false;
          s.verified = true;
          $scope.querySelect = res.data;
          $scope.slideUp('collapse-mappreview')
          $scope.getSourceColumns(res.data[0], s);
        } else {
          $scope.querySelect = [];
          s.checked = true;
          s.isChecking = false;
          s.verified = false;
        }
      }, function (err) {
        s.checked = true;
        s.isChecking = false;
        s.verified = false;
        console.log(err);
      });
    };

    $scope.showCreationWizard = function () {
      $("#creationsourceModal").modal('show');
    }

    $scope.$on("$routeChangeSuccess", function(event, next, current) {
      if (next.templateUrl === 'views/apps/phonebook.html') {
        $scope.getDestColumns();
        $scope.getAllSources();
        $scope.getAllGroups();
        $scope.getCtiUsers();
      }
    });

    $scope.$on('loginCompleted', function (event, args) {
      $scope.getDestColumns();
      $scope.getAllSources();
      $scope.getAllGroups();
      $scope.getCtiUsers();
    });
  });
