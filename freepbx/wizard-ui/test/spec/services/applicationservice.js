'use strict';

describe('Service: ApplicationService', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var ApplicationService;
  beforeEach(inject(function (_ApplicationService_) {
    ApplicationService = _ApplicationService_;
  }));

  it('should do something', function () {
    expect(!!ApplicationService).toBe(true);
  });

});
