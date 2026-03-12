'use strict';

describe('Service: PhoneService', function () {

  beforeEach(module('nethvoiceWizardUiApp'));

  var PhoneService;

  beforeEach(inject(function (_PhoneService_) {
    PhoneService = _PhoneService_;
  }));

  it('should resolve a vendor from a MAC range map', function () {
    var macVendors = {
      'Yealink/Dreamwave': [{
        start: '80-5E-0C-00-00-00',
        end: '80-5E-0C-FF-FF-FF'
      }],
      Fanvil: [{
        start: '0C-38-3E-10-00-00',
        end: '0C-38-3E-1F-FF-FF'
      }]
    };

    expect(PhoneService.getVendor('80:5e:0c:12:34:56', macVendors)).toBe('Yealink/Dreamwave');
    expect(PhoneService.getVendor('0c-38-3e-1a-00-01', macVendors)).toBe('Fanvil');
  });

  it('should return all vendors from the range map keys', function () {
    var macVendors = {
      Snom: [{
        start: '00-04-13-00-00-00',
        end: '00-04-13-FF-FF-FF'
      }],
      '2N': [{
        start: '7C-1E-B3-00-00-00',
        end: '7C-1E-B3-FF-FF-FF'
      }]
    };

    expect(PhoneService.getAllVendors(macVendors)).toEqual(['Snom', '2N']);
  });

  it('should return undefined when no vendor matches the MAC address', function () {
    var macVendors = {
      Snom: [{
        start: '00-04-13-00-00-00',
        end: '00-04-13-FF-FF-FF'
      }]
    };

    expect(PhoneService.getVendor('AA-BB-CC-00-00-01', macVendors)).toBeUndefined();
  });
});