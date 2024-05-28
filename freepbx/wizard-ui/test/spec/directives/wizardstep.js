'use strict';

describe('Directive: wizardStep', function () {

  // load the directive's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var element,
    scope;

  beforeEach(inject(function ($rootScope) {
    scope = $rootScope.$new();
  }));

  it('should make hidden element visible', inject(function ($compile) {
    element = angular.element('<-wizard-step></-wizard-step>');
    element = $compile(element)(scope);
    expect(element.text()).toBe('this is the wizardStep directive');
  }));
});
