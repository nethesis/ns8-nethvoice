'use strict';

describe('Controller: AppsStreamingCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var AppsStreamingCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    AppsStreamingCtrl = $controller('AppsStreamingCtrl', {
      $scope: scope
      // place here mocked dependencies
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(AppsStreamingCtrl.awesomeThings.length).toBe(3);
  });
});
