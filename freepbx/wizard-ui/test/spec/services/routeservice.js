'use strict';

describe('Service: RouteService', function () {

  // load the service's module
  beforeEach(module('nethvoiceWizardUiApp'));

  // instantiate service
  var RouteService;
  beforeEach(inject(function (_RouteService_) {
    RouteService = _RouteService_;
  }));

  it('should do something', function () {
    expect(!!RouteService).toBe(true);
  });

});
