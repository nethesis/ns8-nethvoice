'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:ConfigmigrationCtrl
 * @description
 * # ConfigmigrationCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('ConfigmigrationCtrl', function ($scope, $location, MigrationService) {

    $scope.view.changeRoute = false;

    $scope.nextSepMig = function (key) {
      for (var objKey in $scope.migration) {
        if (previous) {
          $scope.migration[objKey].action();
          break;
        }
        if (objKey === key) {
          var previous = true;
        }
      }
    }

    $scope.migration = {
      vtrunks : {
        id : 0,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $('html, body').animate({
            scrollTop: 0
          }, 1);
          $scope.startItemMig("vtrunks");
          MigrationService.importOldVoipTrunks().then(function (res) {
            $scope.successItemMig("vtrunks", res.data);
            $scope.slideDown("collapse-vtrunks");
          }, function (err) {
            $scope.failItemMig("vtrunks", err.data);
            $scope.slideDown("collapse-vtrunks");
            console.log(err);
          });
        }
      },
      gateptrunks: {
        id : 1,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("gateptrunks");
          MigrationService.importOldGateways().then(function (res) {
            $scope.successItemMig("gateptrunks", res.data);
            $scope.slideDown("collapse-gateptrunks");
          }, function (err) {
            $scope.failItemMig("gateptrunks", err.data);
            $scope.slideDown("collapse-gateptrunks");
            console.log(err);
          });
        }
      },
      iax: {
        id : 2,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("iax");
          MigrationService.importIax().then(function (res) {
            $scope.successItemMig("iax", res.data);
            $scope.slideDown("collapse-iax");
          }, function (err) {
            $scope.failItemMig("iax", err.data);
            $scope.slideDown("collapse-iax");
            console.log(err);
          });
        }
      },
      outroutes: {
        id : 3,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("outroutes");
          MigrationService.importOldOutRoutes().then(function (res) {
            MigrationService.assignTrunksRoutes().then(function (res) {
              $scope.successItemMig("outroutes", res.data);
              $scope.slideDown("collapse-outroutes");
            }, function (err) {
              $scope.failItemMig("outroutes", err.data);
              $scope.slideDown("collapse-outroutes");
              console.log(err);
            });
          }, function (err) {
            $scope.failItemMig("outroutes", err.data);
            $scope.slideDown("collapse-outroutes");
            console.log(err);
          });
        }
      },
      groups: {
        id : 4,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("groups");
          MigrationService.importGroups().then(function (res) {
            $scope.successItemMig("groups", res.data);
            $scope.slideDown("collapse-groups");
          }, function (err) {
            $scope.failItemMig("groups", err.data);
            $scope.slideDown("collapse-groups");
            console.log(err);
          });
        }
      },
      queues: {
        id : 5,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("queues");
          MigrationService.importQueues().then(function (res) {
            $scope.successItemMig("queues", res.data);
            $scope.slideDown("collapse-queues");
          }, function (err) {
            $scope.failItemMig("queues", err.data);
            $scope.slideDown("collapse-queues");
            console.log(err);
          });
        }
      },
      ivr: {
        id : 6,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("ivr");
          MigrationService.importIvr().then(function (res) {
            $scope.successItemMig("ivr", res.data);
            $scope.slideDown("collapse-ivr");
          }, function (err) {
            $scope.failItemMig("ivr", err.data);
            $scope.slideDown("collapse-ivr");
            console.log(err);
          });
        }
      },
      cqr: {
        id : 7,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("cqr");
          MigrationService.importCqr().then(function (res) {
            $scope.successItemMig("cqr", res.data);
            $scope.slideDown("collapse-cqr");
          }, function (err) {
            $scope.failItemMig("cqr", err.data);
            $scope.slideDown("collapse-cqr");
            console.log(err);
          });
        }
      },
      recordings: {
        id : 8,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("recordings");
          MigrationService.importRecordings().then(function (res) {
            $scope.successItemMig("recordings", res.data);
            $scope.slideDown("collapse-recordings");
          }, function (err) {
            $scope.failItemMig("recordings", err.data);
            $scope.slideDown("collapse-recordings");
            console.log(err);
          });
        }
      },
      announcements: {
        id : 9,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("announcements");
          MigrationService.importAnnouncements().then(function (res) {
            $scope.successItemMig("announcements", res.data);
            $scope.slideDown("collapse-announcements");
          }, function (err) {
            $scope.failItemMig("announcements", err.data);
            $scope.slideDown("collapse-announcements");
            console.log(err);
          });
        }
      },
      daynight: {
        id : 10,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("daynight");
          MigrationService.importDaynight().then(function (res) {
            $scope.successItemMig("daynight", res.data);
            $scope.slideDown("collapse-daynight");
          }, function (err) {
            $scope.failItemMig("daynight", err.data);
            $scope.slideDown("collapse-daynight");
            console.log(err);
          });
        }
      },
      tgroupstcond: {
        id : 11,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("tgroupstcond");
          MigrationService.importTimegroups().then(function (res) {
            MigrationService.importTimeconditions().then(function (res) {
              $scope.successItemMig("tgroupstcond", res.data);
              $scope.slideDown("collapse-tgroupstcond");
            }, function (err) {
              $scope.failItemMig("tgroupstcond", err.data);
              $scope.slideDown("collapse-tgroupstcond");
              console.log(err);
            });
          }, function (err) {
            $scope.failItemMig("tgroupstcond", err.data);
            $scope.slideDown("collapse-tgroupstcond");
            console.log(err);
          });
        }
      },
      iroutes: {
        id : 12,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("iroutes");
          MigrationService.importInRoutes().then(function (res) {
            $scope.successItemMig("iroutes", res.data);
            $scope.slideDown("collapse-iroutes");
          }, function (err) {
            $scope.failItemMig("iroutes", err.data);
            $scope.slideDown("collapse-iroutes");
            console.log(err);
          });
        }
      },
      postmig: {
        id : 13,
        started: false,
        loading: false,
        completed: false,
        statusDone: false,
        status: 'todo',
        data: {},
        action: function () {
          $scope.startItemMig("postmig");
          MigrationService.importPostMig().then(function (res) {
            $scope.successItemMig("postmig", res.data);
            $scope.slideDown("collapse-postmig");
            $scope.wizard.confMigrationDone = true;
          }, function (err) {
            $scope.failItemMig("postmig", err.data);
            $scope.slideDown("collapse-postmig");
            $scope.wizard.confMigrationDone = true;
            console.log(err);
          });
        }
      }
    };

    $scope.goToCdr = function () {
      $location.path("/migration/cdr");
    }

    $scope.setMigCompletedTimeout = function (key, status) {
      if (key !== "postmig") {
        $scope.nextSepMig(key);
      }
    }

    $scope.startItemMig = function (key) {
      $scope.migration[key].started = true;
      $scope.migration[key].loading = true;
    }

    $scope.successItemMig = function (key, data) {
      $scope.migration[key].data = data;
      $scope.migration[key].loading = false;
      $scope.migration[key].status = "success";
      $scope.setMigCompletedTimeout(key, true);
    }
    
    $scope.failItemMig = function (key, data) {
      $scope.migration[key].data = data;
      $scope.migration[key].loading = false;
      $scope.migration[key].status = "fail";
      $scope.setMigCompletedTimeout(key, true);
    }

    $scope.disableDoneSteps = function (status) {
      if (status !== "users") {
        for (var step in $scope.migration) {
          $scope.migration[step].statusDone = true;
          if (status === step) {
            break;
          }
        }
      }
    }

    $scope.validateMigrationStatus = function () {
      MigrationService.getMigrationStatus().then(function (res) {
        var isLabel = migrationConfig.LABEL_INFO[res.data];
        if (isLabel) {
          var nextLabel = migrationConfig.LABEL_INFO[isLabel.next];
          if (res.data !== "done" && res.data !== "cdr" && nextLabel.route === $location.path()) {

            $scope.migration[isLabel.next].action();
            $scope.disableDoneSteps(res.data);
          } else {
            $scope.redirectOnMigrationStatus(res.data);
          } 
        } else {
          $scope.redirectOnMigrationStatus(res.data);
        }
      }, function (err) {
        console.log(err);
      });
    }

    $scope.validateMigrationStatus();

  });
