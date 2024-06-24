'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:TrunksVoipCtrl
 * @description
 * # TrunksVoipCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('TrunksVoipCtrl', function ($scope, $rootScope, TrunkService, CodecService, $timeout, $filter, DashboardService) {

    $scope.providers = []
    $scope.voipTrunks = []
    $scope.trunksInfo = []
    $scope.view.changeRoute = true
    $scope.selectedTrunk = {}
    $scope.onSaveError = false;
    $scope.searchTrunk = ""
    $scope.newPwd = ""
    $scope.voipLimit = 20;

    $scope.onDelete = false
    $scope.onDeleteError = false
    $scope.onDeleteSuccess = false
    $scope.onSave = false
    $scope.onSaveError = false
    $scope.onSaveSuccess = false

    //Insert all the data that will gonna be edited
    $scope.editedSelectedTrunk = {}

    $scope.trunk = {
      forceCodec: true,
      codecs: ['alaw', 'ulaw']
    };

    $scope.retrieveCodecs = function () {
      return CodecService.getVoipCodecs();
    }

    $scope.voipContainer = function(){
      if($scope.voipTrunks){
        if ($scope.voipTrunks.length > $scope.voipLimit) {
          $scope.voipLimit += $scope.SCROLLPLUS
        }
      }
    }

    /**
     * When the user will click on the
     * edit button, we copy the value
     * of the selected trunk on the new
     * object
     */
    $scope.clickedEdit = function (){
      $scope.editedSelectedTrunk = angular.copy($scope.selectedTrunk)
      $scope.editedSelectedTrunk.forceCodec = angular.copy($scope.trunk.forceCodec)
      $scope.editedSelectedTrunk.info = angular.copy($scope.trunksInfo)
    }

    var getProvidersList = function () {
      TrunkService.getProviders().then(function (res) {
        $scope.providers = res;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.selectTrunk = function (trunk) {
      $scope.selectedTrunk = trunk
      if ($scope.newCreated) $scope.newCreated = false
    }

    $scope.providerDesc = function (provider) {
      return $scope.providers ? $scope.providers.find(el => el.provider === provider).description : "-"
    }

    $scope.arrayJoin = function (arr) {
      return (arr.length > 0) ? arr.join(", ") : ""
    }

    var getVoipTrunksList = function (selectId) {
      TrunkService.getAllTrunks().then(function (res) {
        // filter data
        let filteredData = res.data.filter((trunk) => {  
          return (trunk.tech === "sip" || trunk.tech === "pjsip")
        })
        // order data
        $scope.voipTrunks = $filter("orderBy")(filteredData, "name")
        if ($scope.voipTrunks.length > 0) {
          // set selected trunk
          if (selectId) {
            $scope.selectedTrunk = $scope.voipTrunks.find(el => el.trunkid == selectId)
          } else {
            for (var i in $scope.voipTrunks) {
              if ($scope.voipTrunks[i].tech == 'sip' || $scope.voipTrunks[i].tech == 'pjsip') {
                $scope.selectedTrunk = $scope.voipTrunks[i]
                break
              }
            }
          }
        } else {
          // empty selected trunk
          $scope.selectedTrunk = {}
        }
        $scope.view.changeRoute = false;
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    }

    var getVoipTrunksInfo = function () {
      DashboardService.getTrunks().then(function (res) {
        $scope.trunksInfo = res.data;
        if(!$scope.$$phase) {
          $scope.$apply()
        }
      }, function (err) {
        console.log(err);
      });
    }

    $scope.create = function () {
      $scope.onSave = true
      TrunkService.createTrunkVoip($scope.trunk).then(function (res) {
        $scope.onSave = false
        $scope.onSaveError = false
        $scope.onSaveSuccess = true
        getVoipTrunksList(res.data.trunkid)
        $timeout(function () {
          $("#newGwDialog").modal("hide")
          $scope.onSaveSuccess = false
          $scope.newCreated = true
          $scope.trunk = {
            forceCodec: true,
            codecs: ['alaw', 'ulaw']
          }
        }, 1000)
        getVoipTrunksInfo()
        // count all trunks
        TrunkService.count().then(function (res) {
          $scope.menuCount.trunks = res.data;
        }, function (err) {
          console.log(err);
        });
      }, function (err) {
        $scope.onSave = false
        $scope.onSaveError = true
        console.log(err);
      });
    };

    $scope.deleteTrunk = function (trunk) {
      $scope.onDelete = true
      TrunkService.deleteTrunk(trunk.trunkid).then(function (res) {
        getVoipTrunksList()
        getVoipTrunksInfo()
        $scope.onDelete = false
        $scope.onDeleteSuccess = true
        $scope.onDeleteError = false
        $timeout(function () {
          $("#confirmDeleteModal").modal("hide")
          $scope.onDeleteSuccess = false
          $scope.onDeleteError = false
        }, 1000)
      }, function (err) {
        $scope.onDelete = false
        $scope.onDeleteError = true
        console.log(err);
      })
    }

    $scope.editTrunks = function (trunk) {
      $scope.onChange = true
      TrunkService.changeTrunkPwd(trunk.trunkid,{
        "username": trunk.username,
        "password": $scope.newPwd,
        "phone": trunk.outcid,
        "codecs": trunk.info[trunk.name].codecs,
        "forceCodec": trunk.forceCodec
      }).then(function () {
        $scope.onChangeSuccess = true
        $scope.onChange = false
        $scope.updateData(trunk);
        $timeout(function () {
          $("#changePWDModal").modal("hide")
          $scope.newPwd = "",
          $scope.onChangeSuccess = false
          $scope.onChangeError = false
        }, 1000)
      }, function (err) {
        $scope.onChange = false
        $scope.onChangeError = true
        console.log(err)
      })
    }

    //Update the data
    $scope.updateData = function(trunk){
      $scope.selectedTrunk = trunk;
      $scope.trunksInfo[$scope.selectedTrunk.name].codecs = trunk.info[trunk.name].codecs;
    }

    angular.element(document).ready(function () {
      getProvidersList()
      getVoipTrunksList()
      getVoipTrunksInfo()
      // add modals handlers
      $('#newGwDialog').on('hidden.bs.modal', function () {
        $scope.onSaveError = false
      })
      $('#confirmDeleteModal').on('hidden.bs.modal', function () {
        $scope.onDeleteError = false
      })
      $('#changePWDModal').on('hidden.bs.modal', function () {
        $scope.onPWDChangeError = false
        $scope.newPwd = ""
      })
    })

    // Set default codecs
    $scope.retrieveCodecs().then(function (res) {
      $scope.availableCodecs = res.map(function (a) {
        return a.codec;
      });
      for (var c in res) {
        if (res[c].enabled) {
          $scope.trunk.codecs = [res[c].codec];
        }
      }
    }, function (err) {
      console.log(err);
    });

    $scope.$on('$routeChangeStart', function() {
      $timeout.cancel($scope.updateTrunksInfoAsync);
    })

  });
