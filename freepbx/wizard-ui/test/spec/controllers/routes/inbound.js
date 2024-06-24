'use strict';

describe('Controller: RoutesInboundCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var RoutesInboundCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    RoutesInboundCtrl = $controller('RoutesInboundCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(RoutesInboundCtrl.awesomeThings.length).toBe(3);
  });
});
