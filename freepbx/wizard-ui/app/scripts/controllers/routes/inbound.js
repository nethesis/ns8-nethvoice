'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:RoutesInboundCtrl
 * @description
 * # RoutesInboundCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('RoutesInboundCtrl', function($scope, $rootScope, $interval, RouteService) {
    $scope.routes = {};
    $scope.destinations = {};
    $scope.currentRoute = {};
    $scope.inboundPromise = null;
    $scope.inboundLimit = 20

    $scope.setCurrentRoute = function(route) {
      $scope.currentRoute = route;
    }

    $scope.getRouteList = function(reload) {
      $scope.view.changeRoute = reload;
      RouteService.getInbounds().then(function(res) {
        $scope.routes = res.data.routes;
        $scope.destinations = res.data.destinations;
        $scope.view.changeRoute = false;
        $scope.menuCount.routesIn = $scope.routes.length;
        for (var r in $scope.routes) {
          $scope.routes[r].url = encodeURIComponent($scope.routes[r].extension + ' / ' + $scope.routes[r].cidnum);
        }
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    };

    $rootScope.$on('scrollingContainerView', function () {
      if($scope.routes){
        if ($scope.routes.length > $scope.inboundLimit) {
          $scope.inboundLimit += $scope.SCROLLPLUS
        }
      }
    });
    
    $scope.parseDestinations = function(destination) {
      if (!destination || destination === null || destination.length == 0) {
        return '';
      } else {
        if (typeof $scope.destinations[destination] !== "undefined") {
          var prefix = $scope.destinations[destination].name;
          if (typeof $scope.destinations[destination].category !== "undefined") {
            prefix = $scope.destinations[destination].category;
          }
          return {
            prefix: prefix,
            description: $scope.destinations[destination].description
          };
        } else {
          return destination;
        }
      }
    };

    // Remove a route
    $scope.deleteRoute = function(did, cid) {
      RouteService.deleteInboundRoute(did, cid).then(function(res) {
        $scope.getRouteList(false);
      }, function(err) {
        console.log(err);
      });
    };

    // Modify a route with Visual Plan
    $scope.modifyRoute = function(did, cid) {
      window.open(customConfig.VPLAN_URL + '?did=' + (did + '+ 2%F +' + cid), '_blank');
    };

    // Create a new route with Visual Plan
    $scope.newRoute = function() {
      window.open(customConfig.VPLAN_URL + '?did=new_route');
    };

    $scope.$on('$destroy', function() {
      if ($scope.inboundPromise) {
        $interval.cancel($scope.inboundPromise);
      }
    })

    $scope.getRouteList(true);
    $scope.inboundPromise = $interval(function() {
      $scope.getRouteList(false);
    }, appConfig.INTERVAL_POLLING);

  });