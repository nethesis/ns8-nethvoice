'use strict';

describe('Directive: genericError', function () {

  // load the directive's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var element,
    scope;

  beforeEach(inject(function ($rootScope) {
    scope = $rootScope.$new();
  }));

  it('should make hidden element visible', inject(function ($compile) {
    element = angular.element('<generic-error></generic-error>');
    element = $compile(element)(scope);
    expect(element.text()).toBe('this is the genericError directive');
  }));
});
