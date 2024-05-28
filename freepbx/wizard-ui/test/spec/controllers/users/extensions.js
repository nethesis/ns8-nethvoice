'use strict';

describe('Controller: UsersExtensionsCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var UsersExtensionsCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    UsersExtensionsCtrl = $controller('UsersExtensionsCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(UsersExtensionsCtrl.awesomeThings.length).toBe(3);
  });
});
