'use strict';

describe('Controller: ConfigmigrationCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var ConfigmigrationCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    ConfigmigrationCtrl = $controller('ConfigmigrationCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(ConfigmigrationCtrl.awesomeThings.length).toBe(3);
  });
});
