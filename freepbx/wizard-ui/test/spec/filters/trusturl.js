'use strict';

describe('Filter: trustUrl', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var trustUrl;
  beforeEach(inject(function ($filter) {
    trustUrl = $filter('trustUrl');
  }));

  it('should return the input prefixed with "trustUrl filter:"', function () {
    var text = 'angularjs';
    expect(trustUrl(text)).toBe('trustUrl filter: ' + text);
  });

});
