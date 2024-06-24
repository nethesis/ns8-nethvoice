'use strict';

describe('Controller: AdminLanguagesCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var AdminLanguagesCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    AdminLanguagesCtrl = $controller('AdminLanguagesCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(AdminLanguagesCtrl.awesomeThings.length).toBe(3);
  });
});
