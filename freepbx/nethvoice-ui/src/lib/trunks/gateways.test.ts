//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  decodeBase64,
  describeGatewayError,
  filterGateways,
  findGatewayModel,
  getEmptyGatewayForm,
  getGatewayConfigFileName,
  getGatewayForm,
  getGatewayLabel,
  getGatewayName,
  getGatewayStatus,
  getGatewayTrunkIds,
  getManufacturers,
  getModelLabel,
  getPortNumber,
  hasGatewayValidationIssues,
  isIpv4Address,
  isNetmask,
  normalizeMacAddress,
  parseGatewayModels,
  parseGateways,
  parseHostNetworks,
  toGatewaySaveRequest,
  validateGatewayForm,
  withModelPorts,
  type GatewayForm,
  type GatewayModel,
} from './gateways'
import type { Trunk } from './trunks'

const rawModels = {
  Patton: [
    {
      id: 17,
      model: 'TRI_ISDN_2',
      manufacturer: 'Patton',
      tech: 'isdn',
      n_pri_trunks: 0,
      n_isdn_trunks: 2,
      n_fxo_trunks: 0,
      n_fxs_ext: 0,
      description: 'TRINITY ISDN 2 Porte',
      proxy: 'sip:10.5.4.1:5060;lr',
      ipv4_green: 'voice.example.org',
    },
    {
      id: 11,
      model: 'TRI_FXO_2',
      manufacturer: 'Patton',
      tech: 'fxo',
      n_pri_trunks: '0',
      n_isdn_trunks: '0',
      n_fxo_trunks: '2',
      n_fxs_ext: '0',
      description: 'TRINITY Analogico 2 Porte FXO',
      proxy: 'sip:10.5.4.1:5060;lr',
      ipv4_green: 'voice.example.org',
    },
    {
      id: 19,
      model: 'TRI_PRI_1',
      manufacturer: 'Patton',
      tech: 'pri',
      n_pri_trunks: 1,
      n_isdn_trunks: 0,
      n_fxo_trunks: 0,
      n_fxs_ext: 0,
      description: 'TRINITY PRI 1 Porta',
      proxy: 'sip:10.5.4.1:5060;lr',
      ipv4_green: 'voice.example.org',
    },
  ],
  Grandstream: [
    {
      id: 33,
      model: 'ht802',
      manufacturer: 'Grandstream',
      tech: 'fxs',
      n_pri_trunks: 0,
      n_isdn_trunks: 0,
      n_fxo_trunks: 0,
      n_fxs_ext: 2,
      description: 'HT802 SIP 2 Porte FXS',
      proxy: 'sip:10.5.4.1:5060;lr',
      ipv4_green: 'voice.example.org',
    },
  ],
}

const models = parseGatewayModels(rawModels)

const modelById = (id: number): GatewayModel => {
  const model = findGatewayModel(models, id)

  if (!model) {
    throw new Error(`missing model ${id}`)
  }
  return model
}

const isdnModel = modelById(17)
const fxoModel = modelById(11)
const priModel = modelById(19)
const fxsModel = modelById(33)

const rawGateways = [
  {
    id: 4,
    model_id: 33,
    name: 'Grandstream-HT802 SIP 2 Porte FXS',
    ipv4: '',
    ipv4_new: '192.168.10.24',
    gateway: '192.168.10.1',
    ipv4_green: 'voice.example.org',
    netmask_green: '255.255.255.0',
    mac: '02:2a:3b:4c:5d:6e',
    proxy: 'proxy.example.org',
    model: 33,
    manufacturer: 'Grandstream',
    isConfigured: true,
    trunks_fxs: [{ linked_extension: '301' }],
    isConnected: false,
  },
  {
    id: '3',
    model_id: '17',
    name: 'Patton-TRINITY ISDN 2 Porte',
    ipv4: '192.168.10.20',
    ipv4_new: '192.168.10.20',
    gateway: '192.168.10.1',
    ipv4_green: 'voice.example.org',
    netmask_green: '255.255.255.0',
    mac: '00:A0:BA:0B:1C:DD',
    proxy: 'proxy.example.org',
    model: '17',
    manufacturer: 'Patton',
    isConfigured: true,
    trunks_isdn: [
      { name: 5, type: 'pp' },
      { name: '6', type: 'pmp' },
    ],
    isConnected: false,
  },
]

const gateways = parseGateways(rawGateways)
const [fxsGateway, isdnGateway] = gateways

const filledForm: GatewayForm = {
  manufacturer: 'Patton',
  modelId: '17',
  macAddress: '00:a0:ba:0b:1c:dd',
  ipAddress: '192.168.10.20',
  netmask: '255.255.255.0',
  networkGateway: '192.168.10.1',
  pbxAddress: 'voice.example.org',
  isdnModes: ['pp', 'pmp'],
  fxoNumbers: [],
  fxsExtensions: [],
}

const trunks: Trunk[] = [5, 6].map((id) => ({
  id,
  name: `Patton_0b1cdd_isdn_${id - 5}`,
  technology: 'pjsip',
  phoneNumber: '',
  username: '',
  provider: '',
  sipServer: '192.168.10.20',
  codecs: [],
  disabled: false,
}))

describe('parseGatewayModels', () => {
  it('should flatten the models keeping the manufacturer order', () => {
    expect(getManufacturers(models)).toEqual(['Patton', 'Grandstream'])
  })

  it('should sort the models of a manufacturer by description', () => {
    expect(models.map((model) => model.id)).toEqual([11, 17, 19, 33])
  })

  it('should read port counts given as numbers or strings', () => {
    expect(fxoModel).toEqual({
      id: 11,
      manufacturer: 'Patton',
      model: 'TRI_FXO_2',
      description: 'TRINITY Analogico 2 Porte FXO',
      isdnPorts: 0,
      priPorts: 0,
      fxoPorts: 2,
      fxsPorts: 0,
      proxy: 'sip:10.5.4.1:5060;lr',
      defaultPbxAddress: 'voice.example.org',
    })
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseGatewayModels({ Patton: [{ id: 'x' }] })).toThrow()
  })
})

describe('parseGateways', () => {
  it('should map a gateway with FXS ports', () => {
    expect(fxsGateway).toEqual({
      id: 4,
      name: 'Grandstream-HT802 SIP 2 Porte FXS',
      modelId: 33,
      manufacturer: 'Grandstream',
      macAddress: '02:2A:3B:4C:5D:6E',
      ipAddress: '192.168.10.24',
      netmask: '255.255.255.0',
      networkGateway: '192.168.10.1',
      pbxAddress: 'voice.example.org',
      isdnModes: [],
      fxoNumbers: [],
      fxsExtensions: ['301'],
      trunkIds: [],
    })
  })

  it('should collect port modes and trunk identifiers of an ISDN gateway', () => {
    expect(isdnGateway).toMatchObject({
      id: 3,
      modelId: 17,
      isdnModes: ['pp', 'pmp'],
      trunkIds: [5, 6],
    })
  })

  it('should collect the trunks of PRI and FXO ports', () => {
    const [gateway] = parseGateways([
      {
        ...rawGateways[1],
        trunks_isdn: undefined,
        trunks_pri: [{ linked_trunk: 7 }],
        trunks_fxo: [{ linked_trunk: 8, number: '0721405516' }],
      },
    ])

    expect(gateway.trunkIds).toEqual([7, 8])
    expect(gateway.fxoNumbers).toEqual(['0721405516'])
  })

  it('should accept an empty list', () => {
    expect(parseGateways([])).toEqual([])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseGateways(null)).toThrow()
  })
})

describe('parseHostNetworks', () => {
  it('should accept a missing value', () => {
    expect(parseHostNetworks(null)).toEqual([])
    expect(parseHostNetworks([])).toEqual([])
  })

  it('should read the local networks of the host', () => {
    expect(
      parseHostNetworks([
        {
          network: '192.168.5.0',
          ip: '192.168.5.14',
          netmask: '255.255.255.0',
          gateway: '192.168.5.1',
        },
      ]),
    ).toEqual([{ ip: '192.168.5.14', netmask: '255.255.255.0', gateway: '192.168.5.1' }])
  })
})

describe('labels', () => {
  it('should label a model with description and code', () => {
    expect(getModelLabel(isdnModel)).toBe('TRINITY ISDN 2 Porte (TRI_ISDN_2)')
  })

  it('should label a gateway with manufacturer and model description', () => {
    expect(getGatewayLabel(isdnGateway, models)).toBe('Patton TRINITY ISDN 2 Porte')
  })

  it('should fall back to the configuration name when the model is unknown', () => {
    expect(getGatewayLabel({ ...isdnGateway, manufacturer: '', modelId: 999 }, models)).toBe(
      'Patton-TRINITY ISDN 2 Porte',
    )
  })

  it('should name a configuration as the previous interface did', () => {
    expect(getGatewayName(isdnModel)).toBe('Patton-TRINITY ISDN 2 Porte')
  })

  it('should number the ports from 0 on Patton and from 1 elsewhere', () => {
    expect(getPortNumber('Patton', 0)).toBe(0)
    expect(getPortNumber('Grandstream', 0)).toBe(1)
  })
})

describe('getGatewayTrunkIds', () => {
  it('should list the trunks created by every gateway', () => {
    expect(getGatewayTrunkIds(gateways)).toEqual([5, 6])
  })
})

describe('filterGateways', () => {
  it('should match manufacturer, model, IP and MAC address', () => {
    expect(filterGateways(gateways, '', models)).toHaveLength(2)
    expect(filterGateways(gateways, 'patton', models).map((item) => item.id)).toEqual([3])
    expect(filterGateways(gateways, 'ht802', models).map((item) => item.id)).toEqual([4])
    expect(filterGateways(gateways, '10.24', models).map((item) => item.id)).toEqual([4])
    expect(filterGateways(gateways, '0b:1c', models).map((item) => item.id)).toEqual([3])
    expect(filterGateways(gateways, 'nothing', models)).toEqual([])
  })
})

describe('getGatewayStatus', () => {
  it('should be unknown without live state or without trunks', () => {
    expect(getGatewayStatus(isdnGateway, trunks, undefined)).toBe('unknown')
    expect(getGatewayStatus(isdnGateway, undefined, {})).toBe('unknown')
    expect(getGatewayStatus(fxsGateway, trunks, {})).toBe('unknown')
  })

  it('should be unknown when the PBX does not monitor the trunks yet', () => {
    expect(getGatewayStatus(isdnGateway, trunks, {})).toBe('unknown')
    expect(
      getGatewayStatus(isdnGateway, trunks, {
        Patton_0b1cdd_isdn_0: { status: 'unmonitored', registration: 'unmonitored' },
      }),
    ).toBe('unknown')
  })

  it('should be connected when at least one trunk is reachable', () => {
    expect(
      getGatewayStatus(isdnGateway, trunks, {
        Patton_0b1cdd_isdn_0: { status: 'offline', registration: 'unmonitored' },
        Patton_0b1cdd_isdn_1: { status: 'online', registration: 'unmonitored' },
      }),
    ).toBe('connected')
  })

  it('should be not connected when every trunk is unreachable', () => {
    expect(
      getGatewayStatus(isdnGateway, trunks, {
        Patton_0b1cdd_isdn_0: { status: 'offline', registration: 'unmonitored' },
        Patton_0b1cdd_isdn_1: { status: 'offline', registration: 'unmonitored' },
      }),
    ).toBe('not_connected')
  })
})

describe('address helpers', () => {
  it('should normalize a MAC address to upper case with colons', () => {
    expect(normalizeMacAddress('00:a0:ba:0b:1c:dd')).toBe('00:A0:BA:0B:1C:DD')
    expect(normalizeMacAddress('00-A0-BA-0B-1C-DD')).toBe('00:A0:BA:0B:1C:DD')
    expect(normalizeMacAddress(' 00a0ba0b1cdd ')).toBe('00:A0:BA:0B:1C:DD')
  })

  it('should reject a malformed MAC address', () => {
    expect(normalizeMacAddress('00:a0:ba:0b:1c')).toBe('')
    expect(normalizeMacAddress('zz:a0:ba:0b:1c:dd')).toBe('')
  })

  it('should recognize IPv4 addresses', () => {
    expect(isIpv4Address('192.168.10.20')).toBe(true)
    expect(isIpv4Address('192.168.10.256')).toBe(false)
    expect(isIpv4Address('192.168.10')).toBe(false)
    expect(isIpv4Address('voice.example.org')).toBe(false)
  })

  it('should recognize subnet masks', () => {
    expect(isNetmask('255.255.255.0')).toBe(true)
    expect(isNetmask('255.255.252.0')).toBe(true)
    expect(isNetmask('255.0.255.0')).toBe(false)
    expect(isNetmask('0.0.0.0')).toBe(false)
    expect(isNetmask('192.168.1.1')).toBe(false)
  })
})

describe('gateway form', () => {
  it('should prefill PBX address and network of a new gateway', () => {
    expect(
      getEmptyGatewayForm('voice.example.org', {
        ip: '192.168.5.14',
        netmask: '255.255.255.0',
        gateway: '192.168.5.1',
      }),
    ).toMatchObject({
      manufacturer: '',
      modelId: '',
      pbxAddress: 'voice.example.org',
      netmask: '255.255.255.0',
      networkGateway: '192.168.5.1',
    })
  })

  it('should prefill the form of a configured gateway', () => {
    expect(getGatewayForm(isdnGateway)).toEqual({ ...filledForm, macAddress: '00:A0:BA:0B:1C:DD' })
  })

  it('should size the port settings on the model, keeping the values already set', () => {
    const form = withModelPorts({ ...filledForm, isdnModes: ['pmp'] }, isdnModel)

    expect(form.isdnModes).toEqual(['pmp', 'pp'])
    expect(withModelPorts(form, fxoModel)).toMatchObject({
      isdnModes: [],
      fxoNumbers: ['', ''],
      fxsExtensions: [],
    })
    expect(withModelPorts(form, fxsModel).fxsExtensions).toEqual(['', ''])
    expect(withModelPorts(form, undefined)).toMatchObject({
      isdnModes: [],
      fxoNumbers: [],
      fxsExtensions: [],
    })
  })
})

describe('validateGatewayForm', () => {
  it('should accept a complete form', () => {
    const issues = validateGatewayForm(filledForm, { model: isdnModel, existingMacAddresses: [] })

    expect(issues).toEqual({})
    expect(hasGatewayValidationIssues(issues)).toBe(false)
  })

  it('should require every field', () => {
    expect(
      validateGatewayForm(getEmptyGatewayForm(), { model: undefined, existingMacAddresses: [] }),
    ).toEqual({
      manufacturer: 'trunks.physical.manufacturer_required',
      modelId: 'trunks.physical.model_required',
      macAddress: 'trunks.physical.mac_address_required',
      ipAddress: 'trunks.physical.ip_address_required',
      netmask: 'trunks.physical.netmask_required',
      networkGateway: 'trunks.physical.network_gateway_required',
      pbxAddress: 'trunks.physical.pbx_address_required',
    })
  })

  it('should check the format of the addresses', () => {
    expect(
      validateGatewayForm(
        {
          ...filledForm,
          macAddress: '00:a0:ba',
          ipAddress: '192.168.10',
          netmask: '255.0.255.0',
          networkGateway: 'gateway',
          pbxAddress: 'voice example',
        },
        { model: isdnModel, existingMacAddresses: [] },
      ),
    ).toEqual({
      macAddress: 'trunks.physical.mac_address_invalid',
      ipAddress: 'trunks.physical.ip_address_invalid',
      netmask: 'trunks.physical.netmask_invalid',
      networkGateway: 'trunks.physical.ip_address_invalid',
      pbxAddress: 'trunks.physical.pbx_address_invalid',
    })
  })

  it('should accept an IP address as PBX address', () => {
    expect(
      validateGatewayForm(
        { ...filledForm, pbxAddress: '192.168.10.2' },
        { model: isdnModel, existingMacAddresses: [] },
      ),
    ).toEqual({})
  })

  it('should reject the MAC address of another gateway', () => {
    expect(
      validateGatewayForm(filledForm, {
        model: isdnModel,
        existingMacAddresses: ['00:A0:BA:0B:1C:DD'],
      }).macAddress,
    ).toBe('trunks.physical.mac_address_already_used')
  })

  it('should check the numbers of the analog lines', () => {
    expect(
      validateGatewayForm(
        { ...filledForm, fxoNumbers: ['0721405516', 'line two'] },
        { model: fxoModel, existingMacAddresses: [] },
      ).fxoNumbers,
    ).toEqual({ 1: 'trunks.physical.line_number_invalid' })
  })

  it('should not allow a hole between the assigned FXS ports', () => {
    expect(
      validateGatewayForm(
        { ...filledForm, fxsExtensions: ['', '301'] },
        { model: fxsModel, existingMacAddresses: [] },
      ).fxsExtensions,
    ).toEqual({ 1: 'trunks.physical.fxs_previous_port_required' })
  })

  it('should not allow the same user on two FXS ports', () => {
    expect(
      validateGatewayForm(
        { ...filledForm, fxsExtensions: ['301', '301'] },
        { model: fxsModel, existingMacAddresses: [] },
      ).fxsExtensions,
    ).toEqual({ 1: 'trunks.physical.fxs_user_already_assigned' })
  })

  it('should accept unassigned FXS ports', () => {
    expect(
      validateGatewayForm(
        { ...filledForm, fxsExtensions: ['301', ''] },
        { model: fxsModel, existingMacAddresses: [] },
      ),
    ).toEqual({})
  })
})

describe('toGatewaySaveRequest', () => {
  it('should build the payload of an ISDN gateway', () => {
    expect(toGatewaySaveRequest(filledForm, isdnModel)).toEqual({
      name: 'Patton-TRINITY ISDN 2 Porte',
      model: 17,
      manufacturer: 'Patton',
      mac: '00:A0:BA:0B:1C:DD',
      ipv4: '',
      ipv4_new: '192.168.10.20',
      netmask_green: '255.255.255.0',
      gateway: '192.168.10.1',
      ipv4_green: 'voice.example.org',
      proxy: 'sip:10.5.4.1:5060;lr',
      trunks_isdn: [
        { name: 0, type: 'pp' },
        { name: 1, type: 'pmp' },
      ],
      trunks_pri: [],
      trunks_fxo: [],
      trunks_fxs: [],
    })
  })

  it('should create one trunk for each PRI port', () => {
    expect(toGatewaySaveRequest({ ...filledForm, isdnModes: [] }, priModel).trunks_pri).toEqual([
      { name: 0 },
    ])
  })

  it('should send the numbers of the FXO lines', () => {
    expect(
      toGatewaySaveRequest({ ...filledForm, fxoNumbers: [' 0721405516 ', ''] }, fxoModel)
        .trunks_fxo,
    ).toEqual([
      { name: 0, number: '0721405516' },
      { name: 1, number: '' },
    ])
  })

  it('should send only the FXS ports that have a user', () => {
    expect(
      toGatewaySaveRequest({ ...filledForm, fxsExtensions: ['301', ''] }, fxsModel).trunks_fxs,
    ).toEqual([{ name: 1, linked_extension: '301' }])
  })

  it('should ignore port settings left from another model', () => {
    const request = toGatewaySaveRequest(
      { ...filledForm, isdnModes: ['pp', 'pp', 'pmp', 'pmp'] },
      isdnModel,
    )

    expect(request.trunks_isdn).toHaveLength(2)
  })
})

describe('configuration file', () => {
  it('should name the file after the first word of the configuration', () => {
    expect(getGatewayConfigFileName(isdnGateway)).toBe('Patton-TRINITY.cfg')
    expect(getGatewayConfigFileName(fxsGateway)).toBe('Grandstream-HT802.xml')
    expect(getGatewayConfigFileName({ ...isdnGateway, name: '' })).toBe('gateway.cfg')
  })

  it('should decode the file content', () => {
    expect(new TextDecoder().decode(decodeBase64(btoa('cli version 4.00')))).toBe(
      'cli version 4.00',
    )
  })
})

describe('describeGatewayError', () => {
  const apiError = (body: unknown) =>
    new ApiError({ status: 400, method: 'POST', url: '/freepbx/rest/devices/gateways', body })

  it('should join the errors returned when a gateway cannot be saved', () => {
    expect(
      describeGatewayError(
        apiError({
          status: false,
          errors: ['Missing gateway field mac', 'Missing gateway field name'],
        }),
      ),
    ).toBe('Missing gateway field mac; Missing gateway field name')
  })

  it('should read the message returned when a gateway cannot be deleted', () => {
    expect(describeGatewayError(apiError({ status: 'Gateway configuration not found' }))).toBe(
      'Gateway configuration not found',
    )
  })

  it('should be empty for other errors', () => {
    expect(describeGatewayError(apiError(null))).toBe('')
    expect(describeGatewayError(new Error('network'))).toBe('')
  })
})
