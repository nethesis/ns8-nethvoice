'use strict';

describe('Service: CodecService', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var CodecService;
  beforeEach(inject(function (_CodecService_) {
    CodecService = _CodecService_;
  }));

  it('should do something', function () {
    expect(!!CodecService).toBe(true);
  });

});
