'use strict';

describe('Controller: BulkextensionsCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var BulkextensionsCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    BulkextensionsCtrl = $controller('BulkextensionsCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(BulkextensionsCtrl.awesomeThings.length).toBe(3);
  });
});
