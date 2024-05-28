'use strict';

describe('Service: ProfileService', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var ProfileService;
  beforeEach(inject(function (_ProfileService_) {
    ProfileService = _ProfileService_;
  }));

  it('should do something', function () {
    expect(!!ProfileService).toBe(true);
  });

});
