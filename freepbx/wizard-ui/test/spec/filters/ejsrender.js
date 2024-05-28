'use strict';

describe('Filter: ejsRender', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var ejsRender;
  beforeEach(inject(function ($filter) {
    ejsRender = $filter('ejsRender');
  }));

  it('should return the input prefixed with "ejsRender filter:"', function () {
    var text = 'angularjs';
    expect(ejsRender(text)).toBe('ejsRender filter: ' + text);
  });

});
