'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.migrationservice
 * @description
 * # migrationservice
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('MigrationService', function ($q, RestService) {

    this.isMigration = function () {
      return $q(function (resolve, reject) {
        RestService.get('/migration/ismigration').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getOldUsers = function () {
      return $q(function (resolve, reject) {
        RestService.get('/migration/oldusers').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importProfiles = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/importprofiles').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.importUsers = function (obj) {
      return $q(function (resolve, reject) {
        RestService.post('/migration/importusers', obj).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.importOldVoipTrunks = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/importoldvoiptrunks').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importOldGateways = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/gateways').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importIax = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/iax').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    // needs assignTrunksRoutes after
    this.importOldOutRoutes = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/importoutboundroutes').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.assignTrunksRoutes = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/trunksroutesassignements').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importGroups = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/groups').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importQueues = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/queues').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importIvr = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/ivr').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importCqr = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/cqr').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importRecordings = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/recordings').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importAnnouncements = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/announcements').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importDaynight = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/daynight').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    // needs importTimeconditions after
    this.importTimegroups = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/timegroups').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importTimeconditions = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/timeconditions').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importInRoutes = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/inboundroutes').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importPostMig = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/postmigration').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getCdrLength = function () {
      return $q(function (resolve, reject) {
        RestService.get('/migration/cdrrowcount').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.importCdr = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/cdr').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getCdrStatus = function () {
      return $q(function (resolve, reject) {
        RestService.get('/migration/cdr').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getReport = function () {
      return $q(function (resolve, reject) {
        RestService.get('/migration/report').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.getMigrationStatus = function () {
      return $q(function (resolve, reject) {
        RestService.get('/migration/migrationstatus').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

    this.setMigrationStatus = function (str) {
      return $q(function (resolve, reject) {
        RestService.post('/migration/migrationstatus', str).then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    }

    this.endMigration = function () {
      return $q(function (resolve, reject) {
        RestService.post('/migration/endmigration').then(function (res) {
          resolve(res);
        }, function (err) {
          reject(err);
        });
      });
    };

  });
