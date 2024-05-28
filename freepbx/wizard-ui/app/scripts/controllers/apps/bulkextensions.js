'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:BulkextensionsCtrl
 * @description
 * # BulkextensionsCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('BulkextensionsCtrl', function ($scope, $rootScope, $filter, $location, $q, ConfigService, UserService, UtilService, ProfileService, BulkService) {

    $scope.users = {};
    $scope.interval = {};
    $scope.allGroups = {};
    $scope.profiles = [];
    $scope.bulkData = {};
    $scope.exts = {};
    $scope.temp = {
      advancedOptions: false
    };
    $scope.dest = {};
    $scope.num = {
      tot: 0,
      selected: 0
    };
    $scope.bulkEdit = {}
    $scope.usersLimit = 20

    $scope.view.changeRoute = true;

    $scope.selectDest = {
      busydest: {
        label: 'Busy'
      },
      noanswerdest: {
        label: 'No answer'
      },
      notreachabledest: {
        label: 'Not reachable'
      }
    };

    $scope.phoneTypes = {
      0: 'physical',
      1: 'webrtc'
    }
    $scope.search = {
      string: '',
      result: false
    }

    $rootScope.$on('scrollingContainerView', function () {
      if($scope.users){
        if ($scope.users.length > $scope.usersLimit) {
          $scope.usersLimit += $scope.SCROLLPLUS
        }
      }
    });
    
    $scope.getUserList = function () {
      if (!$scope.lockOnList) {
        $scope.lockOnList = true;
        UserService.list(true).then(function (res) {
          $scope.users = res.data;
          $scope.num.tot = Object.keys($scope.users).length;
          $scope.view.changeRoute = false;
        }, function (err) {
          $scope.users = {}
          $scope.view.changeRoute = false;
          console.log(err);
        });
      }
    };

    $scope.selectUser = function (user) {
      if (user.selected != true) {
        user.selected = true;
        $scope.num.selected++;
      } else {
        user.selected = false;
        $scope.search.result = false;
        $scope.num.selected--;
      }
    }

    $scope.getAllGroups = function () {
      ProfileService.allGroups().then(function (res) {
        $scope.allGroups = res.data;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.selectGroup = function (id) {
      var usersId = [];
      ProfileService.allUserGroups(id).then(function (res) {
        $scope.num.selected = 0;
        for (var g in res.data) {
          for (var u in $scope.users) {
            if (res.data[g].user_id == $scope.users[u].id) {
              usersId.push($scope.users[u].id);
              $scope.users[u].selected = true;
              $scope.num.selected++;
            } else if (!usersId.includes($scope.users[u].id)) {
              $scope.users[u].selected = false;
            }
          }
        }
      }, function (err) {
        console.log(err);
      });
    }

    $scope.selectAll = function (val) {
      for (var u in $scope.users) {
        if (val == true) {
          $scope.num.selected = Object.keys($scope.users).length;
          $scope.users[u].selected = true;
        } else {
          $scope.num.selected = 0;
          $scope.users[u].selected = false;
          $scope.search.result = false;
        }
      }
      $scope.search.string = '';
    }

    $scope.selectInterval = function () {
      $scope.num.selected = 0;
      for (var u in $scope.users) {
        $scope.users[u].selected = false;
        if ($scope.users[u].default_extension >= $scope.interval.from && $scope.users[u].default_extension <= $scope.interval.to) {
          $scope.users[u].selected = true;
          $scope.num.selected++;
        }
      }
      $('#setInterval').modal('hide');
    }

    $scope.bulkEditSave = function () {
      $scope.temp.profile = $scope.bulkEdit.profile;
      $scope.temp.onsave = true;
      if ($scope.bulkEdit.outboundcid === null) {
        $scope.bulkEdit.outboundcid_fixed = null;
      }
      for (var profile in $scope.profiles){
        if ($scope.profiles[profile] == $scope.bulkEdit.profile){
          $scope.bulkEdit.profile = profile;
        }
      }
      BulkService.setBulkInfo($scope.exts, $scope.bulkEdit).then(function (res) {
        $scope.temp.onsave = false;
        for (var d in $scope.selectDest) {
          $scope.selectDest[d].key = '';
          $scope.selectDest[d].selected = '';
          $scope.selectDest[d].value = {};
        }
        $('#bulkEdit').modal('hide');
      }, function (err) {
        $scope.temp.onsave = false;
        console.log(err);
      });
    }

    $scope.initEditModal = function () {
      $scope.bulkEdit = {};
      $scope.selectedUsers = [];
      $scope.temp.profile = "";
      $('#bulkEdit').modal('show');
      for (var u in $scope.users) {
        if ($scope.users[u].default_extension != 'none' && $scope.users[u].selected == true && !$scope.selectedUsers.includes($scope.users[u].default_extension)) {
          $scope.selectedUsers.push($scope.users[u].default_extension);
        }
      }
      $scope.exts = $scope.selectedUsers.join(',');
      if ($scope.exts) {
        BulkService.getBulkInfo($scope.exts).then(function (res) {
          $scope.bulkEdit = res.data;
          if ($scope.bulkEdit.outboundcid) {
            $scope.bulkEdit.outboundcid_fixed = $scope.bulkEdit.outboundcid;
            $scope.bulkEdit.outboundcid = "fixed";
          }
          $scope.bulkData = angular.copy(res.data);
          if ($scope.bulkEdit.ringtime !== null) {
            $scope.bulkEdit.ringtime = parseInt($scope.bulkEdit.ringtime);
          }
          for (var d in $scope.dest) {
            for (var i in $scope.dest[d]) {
              if ($scope.dest[d][i].destination == $scope.bulkEdit.noanswerdest) {
                $scope.selectDest.noanswerdest.selected = $scope.dest[d][i].description;
                $scope.selectDest.noanswerdest.key = d;
                $scope.selectDest.noanswerdest.value = $scope.dest[d];
              }
              if ($scope.dest[d][i].destination == $scope.bulkEdit.busydest) {
                $scope.selectDest.busydest.selected = $scope.dest[d][i].description;
                $scope.selectDest.busydest.key = d;
                $scope.selectDest.busydest.value = $scope.dest[d];
              }
              if ($scope.dest[d][i].destination == $scope.bulkEdit.notreachabledest) {
                $scope.selectDest.notreachabledest.selected = $scope.dest[d][i].description;
                $scope.selectDest.notreachabledest.key = d;
                $scope.selectDest.notreachabledest.value = $scope.dest[d];
              }
            }
          }
        }, function (err) {
          console.log(err);
        });
      }
    }

    /**
     * Check if the selected users
     * has the same profile
     */
    $scope.checkSame = function (){
      $scope.checkUsers = []
      $scope.checkProfile = []
      for (var u in $scope.users) {
        if ($scope.users[u].profile != 'none' &&
          $scope.users[u].selected == true ) {

          $scope.checkUsers.push($scope.users[u].profile)
            if(!$scope.$$phase) {
              $scope.$apply()
            }
          }
        }
         if (areSame($scope.checkUsers)){
          return true
        }
      }

      function areSame(arr)
      {
          let s = new Set(arr);
          return (s.size == 1);
      }

    $scope.selectResults = function (res) {
      var users = $filter('filter')($scope.users, res);
      for (var u in $scope.users) {
          $scope.users[u].selected = false;
      }
      if ($scope.search.result == false) {
        $scope.search.result = true;
      } else {
        $scope.search.result = false;
      }
      for (var u in users) {
        if ($scope.search.result == false) {
          users[u].selected = false;
        } else {
          users[u].selected = true;
        }
      }
    }

    $scope.selectDests = function (key) {
      for (var d in $scope.dest) {
        for (var i in $scope.dest[d]) {
          if ($scope.dest[d][i].destination == $scope.bulkData[key]) {
            $scope.selectDest[key].selected = $scope.dest[d][i].description;
            $scope.selectDest[key].key = d;
            $scope.selectDest[key].value = $scope.dest[d];
          }
        }
      }
    }

    $scope.closeEditModal = function () {
      $('#bulkEdit').modal('hide');
      for (var d in $scope.selectDest) {
        $scope.selectDest[d].key = '';
        $scope.selectDest[d].selected = '';
        $scope.selectDest[d].value = {};
      }
    }

    $scope.lock = function (action, key) {
      if (action == 'disable') {
        $scope.bulkData[key] = $scope.bulkEdit[key];
        $scope.bulkEdit[key] = null;
      } else if (action == 'enable' && ($scope.bulkData[key] !== null)) {
        $scope.bulkEdit[key] = $scope.bulkData[key];
      } else {
        if (key == "callwaiting") {
          $scope.bulkEdit.callwaiting = true;
        } else if (key == "profile") {
          $scope.bulkEdit.profile = 'Standard';
        } else {
          $scope.bulkEdit[key] = '';
        }
      }
    }

    $scope.lockDests = function (action, key) {
      if (action == 'disable') {
        $scope.bulkData[key] = $scope.bulkEdit[key];
        $scope.bulkEdit[key] = null;
        $scope.selectDest[key].value = {};
        $scope.selectDest[key].key = '';
      } else if (action == 'enable' && ($scope.bulkData[key] !== null)) {
        $scope.bulkEdit[key] = $scope.bulkData[key];
        $scope.selectDests(key);
      } else {
        $scope.bulkEdit[key] = "";
      }
    }

    $scope.setDest = function (k, v, dk) {
      $scope.selectDest[dk].value = v;
      $scope.selectDest[dk].key = k;
      $scope.bulkEdit[dk] = v[0].destination;
      $scope.selectDest[dk].selected = v[0].description;
    }

    $scope.setDestVal = function (k, dk) {
      $scope.bulkEdit[dk] = $scope.selectDest[dk].value[k].destination;
      $scope.selectDest[dk].selected = $scope.selectDest[dk].value[k].description;
    }

    $scope.isEmptyObj = function (obj) {
      return UtilService.isEmpty(obj)
    }

    $scope.resetDest = function (dk, val) {
      $scope.bulkEdit[dk] = val;
      $scope.selectDest[dk].value = {};
      $scope.selectDest[dk].key = '';
    }

    BulkService.getDestinations().then(function (res) {
      for (let d in res.data) {
        delete res.data[d][99999]
      }
      $scope.dest = res.data
    }, function (err) {
      console.log(err);
    });

    //call the api to get profiles information
    ProfileService.allProfiles().then(function (res) {
      $scope.profiles = res.data;
    }, function (err) {
      console.log(err)
    });

    $scope.$on( "$routeChangeSuccess", function(event, next, current) {
      if (next.templateUrl === 'views/apps/bulkextensions.html') {
        $scope.getUserList();
        $scope.getAllGroups();
      }
    });

    $scope.$on('loginCompleted', function (event, args) {
      $scope.getUserList();
      $scope.getAllGroups();
    });
  });
