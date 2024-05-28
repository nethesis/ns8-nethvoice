'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:RoutesOutboundCtrl
 * @description
 * # RoutesOutboundCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('RoutesOutboundCtrl', function ($scope, LocalStorageService, LanguageService, TrunkService, RouteService, UtilService) {

    $scope.routes = [];
    $scope.allTrunks = [];
    $scope.filteredTrunks = [];
    $scope.onSaveSuccess = false;
    $scope.onSaveError = false;
    $scope.onSave = false;
    $scope.showDialDefault = false;
    $scope.view.changeRoute = true;

    $scope.toggleDetails = function (event) {
      var $this = $(event.target);
      var $heading = $(event.target).parents(".list-group-item");
      var $subPanels = $heading.find(".list-group-item-container");
      var index = $heading.find(".list-view-pf-expand").index(event.target);

      $heading.find(".list-view-pf-expand.active").find(".fa-angle-right").removeClass("fa-angle-down")
        .end().removeClass("active")
        .end();
      // Add active to the clicked item
      $(event.target).addClass("active")
        .parents(".list-group-item")
        .end().find(".fa-angle-right").addClass("fa-angle-down");
      // check if it needs to hide
      if ($subPanels.eq(index).hasClass("hidden")) {
        $heading.find(".list-group-item-container:visible").addClass("hidden");
        $subPanels.eq(index).removeClass("hidden");
      } else {
        $subPanels.eq(index).addClass("hidden");
        $heading.find(".list-view-pf-expand.active").find(".fa-angle-right").removeClass("fa-angle-down")
          .end().removeClass("active")
          .end();
      }
    };

    $scope.setNewPattern = function(lang) {
      $scope.selectedRouteLang = lang;
    };

    $scope.getLangName = function (key) {
      return LanguageService.getNativeName(key);
    }

    $scope.extractTrunkInfo = function (trunkName) {
      return UtilService.extractTrunkInfo(trunkName);
    };

    $scope.removeTrunk = function (indexRoute, indexTrunk) {
      $scope.routes[$scope.selectedRouteLang][indexRoute].trunks.splice(indexTrunk, 1);
      RouteService.deleteOutboundTrunk(indexRoute, indexTrunk).then(function (res) {
      }, function (err) {
        console.log(err);
      });
    };

    $scope.addTrunkToRoute = function (indexRoute, trunk) {
      $scope.routes[$scope.selectedRouteLang][indexRoute].trunks.push(trunk);
    };

    $scope.filterAllTrunks = function (routeTrunks) {
      return UtilService.intersectTwoObj($scope.allTrunks, routeTrunks, false);
    };

    $scope.saveRoutes = function () {
      $scope.onSave = false;
      var postObj = {};
      postObj[$scope.selectedRouteLang] = $scope.routes[$scope.selectedRouteLang];
      RouteService.createDefaultsOutbounds(postObj).then(function (res) {
        $scope.onSaveSuccess = true;
        $scope.onSaveError = false;
        $scope.onSave = false;
        $scope.getOutbounds(false);
        $scope.wizard.nextState = true;
      }, function (err) {
        console.log(err);
        $scope.onSaveSuccess = false;
        $scope.onSaveError = true;
        $scope.onSave = false;
      });
    };

    $scope.getOutbounds = function (reload) {
      $scope.view.changeRoute = reload;
      RouteService.getOutbounds().then(function (resOutbounds) {
        // outbounds empty? get defaults
        if (resOutbounds.data.length == 0) {
          $scope.showDialDefault = true;
          RouteService.getDefaultOutbounds().then(function (resDefaultOutbounds) {
            $scope.routes = resDefaultOutbounds.data;
            $scope.availableDialPatterns = Object.keys(resDefaultOutbounds.data);
            $scope.routes.length = Object.keys(resDefaultOutbounds.data).length;
            $scope.view.changeRoute = false;
          }, function (err) {
            console.log(err);
          });
        } else {
          $scope.showDialDefault = false;
          $scope.routes[$scope.selectedRouteLang] = resOutbounds.data;
          $scope.routes.length = resOutbounds.data.length;
          $scope.view.changeRoute = false;
          $scope.wizard.nextState = true;
        }
        $scope.menuCount.routesOut = $scope.routes.length;
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    };

    TrunkService.getAllTrunks().then(function (res) {
      var userLang = navigator.language || navigator.userLanguage;
      userLang = userLang.replace('-', '_').split('_')[0];
      $scope.selectedRouteLang = LocalStorageService.get('preferredLanguage') || userLang || 'en';
      $scope.allTrunks = res.data;
      $scope.getOutbounds(true);
    }, function (err) {
      console.log(err);
    });

  });
