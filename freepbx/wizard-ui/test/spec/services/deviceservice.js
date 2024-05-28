'use strict';

describe('Service: DeviceService', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var DeviceService;
  beforeEach(inject(function (_DeviceService_) {
    DeviceService = _DeviceService_;
  }));

  it('should do something', function () {
    expect(!!DeviceService).toBe(true);
  });

});
