'use strict';

describe('Service: PhoneService', function () {

  var allVendorSampleMacs = {
    '2N': ['7C-1E-B3-12-34-56'],
    Aastra: ['00-08-5D-12-34-56', '00-10-BC-12-34-56'],
    AG: ['00-90-33-12-34-56'],
    Akuvox: ['0C-11-05-12-34-56', '9C-75-14-12-34-56'],
    'Alcatel Temporis': ['74-65-D1-12-34-56'],
    'Cisco/Linksys': [
      '00-00-0C-12-34-56',
      '00-01-42-12-34-56',
      '00-01-43-12-34-56',
      '00-01-63-12-34-56',
      '00-01-64-12-34-56',
      '00-01-96-12-34-56',
      '00-01-97-12-34-56',
      '00-01-C7-12-34-56',
      '00-01-C9-12-34-56',
      '00-03-6B-12-34-56',
      '00-07-0E-12-34-56',
      '00-0E-38-12-34-56',
      '00-0E-84-12-34-56',
      '00-0F-23-12-34-56',
      '00-13-C4-12-34-56',
      '00-16-C8-12-34-56',
      '00-17-5A-12-34-56',
      '00-17-95-12-34-56',
      '00-18-18-12-34-56',
      '00-19-30-12-34-56',
      '00-19-AA-12-34-56',
      '00-1A-2F-12-34-56',
      '00-1B-D4-12-34-56',
      '00-1C-58-12-34-56',
      '00-1D-45-12-34-56',
      '00-1D-A2-12-34-56',
      '00-1E-F7-12-34-56',
      '00-21-55-12-34-56',
      '1C-DF-0F-12-34-56',
      '30-E4-DB-12-34-56',
      '3C-CE-73-12-34-56',
      '54-75-D0-12-34-56',
      '54-7C-69-12-34-56',
      '58-BF-EA-12-34-56',
      '64-9E-F3-12-34-56',
      'A4-4C-11-12-34-56',
      'C4-64-13-12-34-56',
      'C8-9C-1D-12-34-56',
      'E0-2F-6D-12-34-56',
      'E0-5F-B9-12-34-56'
    ],
    CloudTC: ['00-00-00-12-34-56'],
    Digium: ['00-0F-D3-12-34-56'],
    Fanvil: ['00-A8-59-12-34-56', '00-A8-5A-12-34-56', '0C-38-3E-12-34-56'],
    Gigaset: ['00-21-04-12-34-56', '14-B3-70-12-34-56', '58-9E-C6-12-34-56', '7C-2F-80-12-34-56'],
    Grandstream: ['00-0B-82-12-34-56', 'C0-74-AD-12-34-56', 'EC-74-D7-12-34-56', '14-4C-FF-12-34-56'],
    Mediatrix: ['00-90-F8-12-34-56'],
    Mitel: ['08-00-0F-12-34-56'],
    Nethesis: ['E0-E6-56-12-34-56'],
    Norphonic: ['00-50-C2-12-34-56', '10-45-BE-12-34-56'],
    Panasonic: ['BC-C3-42-12-34-56'],
    Patton: ['00-A0-BA-12-34-56'],
    Polycom: ['00-04-F2-12-34-56', '00-90-7A-12-34-56'],
    Sangoma: ['00-50-58-12-34-56'],
    Sipura: ['00-0E-08-12-34-56'],
    Snom: ['00-04-13-12-34-56', '1C-71-26-12-34-56'],
    Thomson: ['00-14-7F-12-34-56', '00-1F-9F-12-34-56'],
    Xorcom: ['64-24-00-12-34-56'],
    'Yealink/Dreamwave': [
      '00-15-65-12-34-56',
      '24-9A-D8-12-34-56',
      '44-DB-D2-12-34-56',
      '80-5E-0C-12-34-56',
      '80-5E-C0-12-34-56',
      'C4-FC-22-12-34-56'
    ]
  };

  function buildRangeFromSample(sampleMac) {
    var oui = sampleMac.slice(0, 8).toUpperCase();

    return {
      start: oui + '-00-00-00',
      end: oui + '-FF-FF-FF'
    };
  }

  function buildVendorRangesFromSamples(vendorSamples) {
    var macVendors = {};

    Object.keys(vendorSamples).forEach(function (vendor) {
      macVendors[vendor] = vendorSamples[vendor].map(buildRangeFromSample);
    });

    return macVendors;
  }

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
        { start: '14-B3-70-00-00-00', end: '14-B3-70-FF-FF-FF' }
      ]
    };

    expect(PhoneService.getVendor('14-B3-70-12-34-56', macVendors)).toBe('Gigaset');
  });

  it('should match MAC addresses inside ranges spanning multiple OUIs', function () {
    var macVendors = {
      'Cisco/Linksys': [{
        start: '00-01-42-00-00-00',
        end: '00-01-43-FF-FF-FF'
      }],
      Fanvil: [{
        start: '00-A8-59-00-00-00',
        end: '00-A8-5A-FF-FF-FF'
      }]
    };

    expect(PhoneService.getVendor('00-01-42-12-34-56', macVendors)).toBe('Cisco/Linksys');
    expect(PhoneService.getVendor('00-01-43-12-34-56', macVendors)).toBe('Cisco/Linksys');
    expect(PhoneService.getVendor('00-A8-59-12-34-56', macVendors)).toBe('Fanvil');
    expect(PhoneService.getVendor('00-A8-5A-12-34-56', macVendors)).toBe('Fanvil');
  });

  it('should resolve every configured vendor sample MAC', function () {
    var macVendors = buildVendorRangesFromSamples(allVendorSampleMacs);

    Object.keys(allVendorSampleMacs).forEach(function (vendor) {
      allVendorSampleMacs[vendor].forEach(function (mac) {
        expect(PhoneService.getVendor(mac, macVendors)).toBe(vendor);
      });
    });
  });

  it('should return undefined for null or undefined MAC', function () {
    expect(PhoneService.getVendor(null, {})).toBeUndefined();
    expect(PhoneService.getVendor(undefined, {})).toBeUndefined();
  });
});