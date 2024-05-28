'use strict';

describe('Filter: maskToCidr', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var maskToCidr;
  beforeEach(inject(function ($filter) {
    maskToCidr = $filter('maskToCidr');
  }));

  it('should return the input prefixed with "maskToCidr filter:"', function () {
    var text = 'angularjs';
    expect(maskToCidr(text)).toBe('maskToCidr filter: ' + text);
  });

});
