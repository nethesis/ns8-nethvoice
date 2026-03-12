'use strict';

describe('Filter: customFilterMultiple', function () {

  beforeEach(module('nethvoiceWizardUiApp'));

  var customFilterMultiple;

  beforeEach(inject(function ($filter) {
    customFilterMultiple = $filter('customFilterMultiple');
  }));

  var getResultCount = function (result) {
    return Object.keys(result).length;
  };

  it('should match configuration devices by MAC regardless of separators', function () {
    var users = [{
      username: 'jdoe',
      displayname: 'John Doe',
      default_extension: '200',
      devices: [{
        mac: '0C-38-3E-32-A7-CB',
        extension: '200'
      }]
    }];

    expect(getResultCount(customFilterMultiple(users, 'configurationsUsersSearch', '0C-38-3E-32-A7-CB'))).toBe(1);
    expect(getResultCount(customFilterMultiple(users, 'configurationsUsersSearch', '0C:38:3E:32:A7:CB'))).toBe(1);
    expect(getResultCount(customFilterMultiple(users, 'configurationsUsersSearch', '0C383E32A7CB'))).toBe(1);
  });

  it('should keep extension matching unchanged', function () {
    var users = [{
      username: 'jdoe',
      displayname: 'John Doe',
      default_extension: '200',
      devices: [{
        mac: '0C-38-3E-32-A7-CB',
        extension: '200'
      }]
    }];

    expect(getResultCount(customFilterMultiple(users, 'configurationsUsersSearch', '200'))).toBe(1);
  });
});