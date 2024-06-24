'use strict';

describe('Controller: BulkdevicesCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var BulkdevicesCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    BulkdevicesCtrl = $controller('BulkdevicesCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(BulkdevicesCtrl.awesomeThings.length).toBe(3);
  });
});
