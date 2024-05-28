'use strict';

describe('Filter: regexpParse', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var regexpParse;
  beforeEach(inject(function ($filter) {
    regexpParse = $filter('regexpParse');
  }));

  it('should return the input prefixed with "regexpParse filter:"', function () {
    var text = 'angularjs';
    expect(regexpParse(text)).toBe('regexpParse filter: ' + text);
  });

});
