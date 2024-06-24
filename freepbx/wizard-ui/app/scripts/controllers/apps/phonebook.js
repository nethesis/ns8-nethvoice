'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:PhonebookCtrl
 * @description
 * # PhonebookCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('PhonebookCtrl', function ($scope, ApplicationService, PhonebookService) {

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
      }
    }

    $scope.allDBTypes = {
      "mysql": "MySQL",
      "csv": "CSV"
    };

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

    $scope.colsSources = {};
    $scope.colsDestinations = {};

    $scope.view.changeRoute = true;

    $scope.getSourceName = function (pbo, defval) {
      return pbo.type ? pbo.type : defval;
    };

    $scope.getSourceType = function (pbo, defval) {
      return $scope.allDBTypes[pbo.dbtype] ? $scope.allDBTypes[pbo.dbtype] : defval;
    };

    // rest api functions
    $scope.getAllSources = function () {
      PhonebookService.readConfig().then(function (res) {
        $scope.allSources = res.data;
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
      setTimeout(function () {
        $scope.checkConnection(g);
      }, 500);
    }

    $scope.newSourceEvent = function () {
      $scope.ui.onModify = false;
      $scope.switchsourceModalTab("datasource");
      $scope.querySelect = [];
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
      } else if (s.dbtype == 'csv') {
        payload = {
          dbtype: 'csv',
          url: s.url,
        };
      }
      payload.type = s.type;
      payload.mapping = s.mapping;
      payload.enabled = s.enabled;
      payload.interval = s.interval;
      return payload;
    };

    $scope.saveSource = function () {
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
      }
    });

    $scope.$on('loginCompleted', function (event, args) {
      $scope.getDestColumns();
      $scope.getAllSources();
    });
  });