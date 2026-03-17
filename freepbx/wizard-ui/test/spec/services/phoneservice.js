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
      }, {
        start: 'C4-FC-22-00-00-00',
        end: 'C4-FC-22-FF-FF-FF'
      }],
      Fanvil: [{
        start: '0C-38-3E-10-00-00',
        end: '0C-38-3E-1F-FF-FF'
      }]
    };

    expect(PhoneService.getVendor('80:5e:0c:12:34:56', macVendors)).toBe('Yealink/Dreamwave');
    expect(PhoneService.getVendor('C4-FC-22-0D-06-04', macVendors)).toBe('Yealink/Dreamwave');
    expect(PhoneService.getVendor('0c-38-3e-1a-00-01', macVendors)).toBe('Fanvil');
  });

  it('should match Yealink models for Yealink/Dreamwave vendors', function () {
    var macVendors = {
      'Yealink/Dreamwave': [{
        start: 'C4-FC-22-00-00-00',
        end: 'C4-FC-22-FF-FF-FF'
      }]
    };
    var models = [
      { name: 'yealink-T46S' },
      { name: 'fanvil-X3S' }
    ];

    expect(PhoneService.getFilteredModels('C4-FC-22-0D-06-04', models, macVendors)).toEqual([
      { name: 'yealink-T46S' }
    ]);
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

  it('should match MAC addresses at the exact range boundaries', function () {
    var macVendors = {
      Snom: [{ start: '00-04-13-00-00-00', end: '00-04-13-FF-FF-FF' }]
    };

    expect(PhoneService.getVendor('00-04-13-00-00-00', macVendors)).toBe('Snom');
    expect(PhoneService.getVendor('00-04-13-FF-FF-FF', macVendors)).toBe('Snom');
  });

  it('should match a MAC in the second range of a multi-range vendor', function () {
    var macVendors = {
      Gigaset: [
        { start: '7C-2F-80-00-00-00', end: '7C-2F-80-FF-FF-FF' },
        { start: 'AC-37-43-00-00-00', end: 'AC-37-43-FF-FF-FF' }
      ]
    };

    expect(PhoneService.getVendor('AC-37-43-12-34-56', macVendors)).toBe('Gigaset');
  });

  it('should return undefined for null or undefined MAC', function () {
    expect(PhoneService.getVendor(null, {})).toBeUndefined();
    expect(PhoneService.getVendor(undefined, {})).toBeUndefined();
  });
});