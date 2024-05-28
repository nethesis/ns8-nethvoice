'use strict';

describe('Service: RestService', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var RestService;
  beforeEach(inject(function (_RestService_) {
    RestService = _RestService_;
  }));

  it('should do something', function () {
    expect(!!RestService).toBe(true);
  });

});
