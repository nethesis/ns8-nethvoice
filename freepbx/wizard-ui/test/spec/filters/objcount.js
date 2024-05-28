'use strict';

describe('Filter: objCount', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var objCount;
  beforeEach(inject(function ($filter) {
    objCount = $filter('objCount');
  }));

  it('should return the input prefixed with "objCount filter:"', function () {
    var text = 'angularjs';
    expect(objCount(text)).toBe('objCount filter: ' + text);
  });

});
