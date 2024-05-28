'use strict';

describe('Controller: TrunksPhysicalCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var TrunksPhysicalCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    TrunksPhysicalCtrl = $controller('TrunksPhysicalCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(TrunksPhysicalCtrl.awesomeThings.length).toBe(3);
  });
});
