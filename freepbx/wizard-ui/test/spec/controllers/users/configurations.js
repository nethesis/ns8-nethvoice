'use strict';

describe('Controller: UsersConfigurationsCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var UsersConfigurationsCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    UsersConfigurationsCtrl = $controller('UsersConfigurationsCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(UsersConfigurationsCtrl.awesomeThings.length).toBe(3);
  });
});
