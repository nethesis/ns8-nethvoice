'use strict';

describe('Service: LocalStorageService', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var LocalStorageService;
  beforeEach(inject(function (_LocalStorageService_) {
    LocalStorageService = _LocalStorageService_;
  }));

  it('should do something', function () {
    expect(!!LocalStorageService).toBe(true);
  });

});
