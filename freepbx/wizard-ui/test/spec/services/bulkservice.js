'use strict';

describe('Service: bulkservice', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var bulkservice;
  beforeEach(inject(function (_bulkservice_) {
    bulkservice = _bulkservice_;
  }));

  it('should do something', function () {
    expect(!!bulkservice).toBe(true);
  });

});
