'use strict';

describe('Controller: TrunksVoipCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var TrunksVoipCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    TrunksVoipCtrl = $controller('TrunksVoipCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(TrunksVoipCtrl.awesomeThings.length).toBe(3);
  });
});
