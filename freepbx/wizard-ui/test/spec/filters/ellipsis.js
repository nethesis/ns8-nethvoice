'use strict';

describe('Filter: ellipsis', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var ellipsis;
  beforeEach(inject(function ($filter) {
    ellipsis = $filter('ellipsis');
  }));

  it('should return the input prefixed with "ellipsis filter:"', function () {
    var text = 'angularjs';
    expect(ellipsis(text)).toBe('ellipsis filter: ' + text);
  });

});
