'use strict';

describe('Controller: RoutesOutboundCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var RoutesOutboundCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    RoutesOutboundCtrl = $controller('RoutesOutboundCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(RoutesOutboundCtrl.awesomeThings.length).toBe(3);
  });
});
