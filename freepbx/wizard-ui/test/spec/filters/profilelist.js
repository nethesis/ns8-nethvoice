'use strict';

describe('Filter: profileList', function () {

  // load the filter's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // initialize a new instance of the filter before each test
  var profileList;
  beforeEach(inject(function ($filter) {
    profileList = $filter('profileList');
  }));

  it('should return the input prefixed with "profileList filter:"', function () {
    var text = 'angularjs';
    expect(profileList(text)).toBe('profileList filter: ' + text);
  });

});
