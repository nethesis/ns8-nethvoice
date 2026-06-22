'use strict';

describe('Filter: customFilterMultiple', function () {

  beforeEach(module('nethvoiceWizardUiApp'));

  var customFilterMultiple;

  beforeEach(inject(function ($filter) {
    customFilterMultiple = $filter('customFilterMultiple');
  }));

  var getResultCount = function (result) {
    return angular.isArray(result) ? result.length : Object.keys(result).length;
  };

  it('should preserve array results for orderBy consumers', function () {
    var users = [{
      username: 'jdoe',
      displayname: 'John Doe',
      default_extension: '200'
    }];

    var result = customFilterMultiple(users, 'displayname,username,default_extension', 'john');

    expect(angular.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  it('should convert object inputs to arrays when search is empty', function () {
    var users = {
      jdoe: {
        username: 'jdoe',
        displayname: 'John Doe',
        default_extension: '200'
      }
    };

    var result = customFilterMultiple(users, 'displayname,username,default_extension', '');

    expect(angular.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('jdoe');
  });

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
    expect(getResultCount(customFilterMultiple(users, 'configurationsUsersSearch', '0c383e32a7cb'))).toBe(1);
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