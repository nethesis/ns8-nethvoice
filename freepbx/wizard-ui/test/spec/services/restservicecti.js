'use strict';

describe('Service: RestServiceCTI', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var RestServiceCTI;
  beforeEach(inject(function (_RestServiceCTI_) {
    RestServiceCTI = _RestServiceCTI_;
  }));

  it('should do something', function () {
    expect(!!RestServiceCTI).toBe(true);
  });

});
