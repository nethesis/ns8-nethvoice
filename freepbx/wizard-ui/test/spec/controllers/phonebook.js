'use strict';

describe('Controller: PhonebookCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var PhonebookCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    PhonebookCtrl = $controller('PhonebookCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(PhonebookCtrl.awesomeThings.length).toBe(3);
  });
});
