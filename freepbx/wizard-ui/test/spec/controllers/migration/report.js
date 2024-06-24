'use strict';

describe('Controller: ReportCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var ReportCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    ReportCtrl = $controller('ReportCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(ReportCtrl.awesomeThings.length).toBe(3);
  });
});
