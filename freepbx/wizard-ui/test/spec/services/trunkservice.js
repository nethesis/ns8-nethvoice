'use strict';

describe('Service: trunkservice', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var trunkservice;
  beforeEach(inject(function (_trunkservice_) {
    trunkservice = _trunkservice_;
  }));

  it('should do something', function () {
    expect(!!trunkservice).toBe(true);
  });

});
