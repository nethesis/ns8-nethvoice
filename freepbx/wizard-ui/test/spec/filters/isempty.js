'use strict';

describe('Filter: isEmpty', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var isEmpty;
  beforeEach(inject(function ($filter) {
    isEmpty = $filter('isEmpty');
  }));

  it('should return the input prefixed with "isEmpty filter:"', function () {
    var text = 'angularjs';
    expect(isEmpty(text)).toBe('isEmpty filter: ' + text);
  });

});
