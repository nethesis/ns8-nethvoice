'use strict';

describe('Filter: toBase64', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var toBase64;
  beforeEach(inject(function ($filter) {
    toBase64 = $filter('toBase64');
  }));

  it('should return the input prefixed with "toBase64 filter:"', function () {
    var text = 'angularjs';
    expect(toBase64(text)).toBe('toBase64 filter: ' + text);
  });

});
