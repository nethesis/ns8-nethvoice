//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  getCallableLines,
  getGatewayCallLines,
  getGatewayLinePort,
  getTrunkCallDestination,
  getTrunkCallLines,
  getTrunkCallStatus,
  isTrunkCallBlocked,
  normalizeTrunkCallNumber,
  validateTrunkCallNumber,
  type TrunkCallContext,
} from './trunkCall'
import type { Trunk } from './trunks'
import type { Gateway } from './gateways'

const trunk = (id: number, name: string, disabled = false): Trunk => ({
  id,
  name,
  technology: 'pjsip',
  phoneNumber: '',
  username: '',
  provider: '',
  sipServer: '',
  codecs: [],
  disabled,
  context: '',
})

const gateway = (trunkIds: number[]): Gateway => ({
  id: 3,
  name: 'Patton-TRINITY ISDN 2 Porte',
  modelId: 17,
  manufacturer: 'Patton',
  macAddress: '00:A0:BA:0B:1C:DD',
  ipAddress: '192.0.2.20',
  netmask: '255.255.255.0',
  networkGateway: '192.0.2.1',
  pbxAddress: 'voice.example.org',
  isdnModes: [],
  fxoNumbers: [],
  fxsExtensions: [],
  trunkIds,
})

const context = (overrides: Partial<TrunkCallContext> = {}): TrunkCallContext => ({
  phoneState: 'ready',
  phoneEnabled: true,
  inCall: false,
  otherTabInCall: false,
  ...overrides,
})

describe('trunk call number', () => {
  it('removes separators', () => {
    expect(normalizeTrunkCallNumber(' +39 (02) 123-45.67/8 ')).toBe('+390212345678')
  })

  it('validates the number', () => {
    expect(validateTrunkCallNumber('')).toBe('trunks.call.number_required')
    expect(validateTrunkCallNumber(' - ')).toBe('trunks.call.number_required')
    expect(validateTrunkCallNumber('02 1234567')).toBe('')
    expect(validateTrunkCallNumber('+39 02 1234567')).toBe('')
    expect(validateTrunkCallNumber('0212*34')).toBe('trunks.call.number_invalid')
    expect(validateTrunkCallNumber('02#1')).toBe('trunks.call.number_invalid')
    expect(validateTrunkCallNumber('39+02')).toBe('trunks.call.number_invalid')
    expect(validateTrunkCallNumber('abc')).toBe('trunks.call.number_invalid')
    expect(validateTrunkCallNumber('1'.repeat(30))).toBe('')
    expect(validateTrunkCallNumber(`+${'1'.repeat(30)}`)).toBe('')
    expect(validateTrunkCallNumber('1'.repeat(31))).toBe('trunks.call.number_too_long')
  })

  it('builds the destination the administrator phone dials', () => {
    expect(getTrunkCallDestination(5, '+39 02 1234567')).toBe('***5*+39021234567')
    expect(getTrunkCallDestination(12, '021234567')).toBe('***12*021234567')
  })
})

describe('trunk call lines', () => {
  it('uses the VoIP trunk as its only line', () => {
    expect(getTrunkCallLines(trunk(2, 'main_trunk'))).toEqual([
      { trunkId: 2, name: 'main_trunk', disabled: false },
    ])
  })

  it('lists the gateway trunks in port order and skips unknown ones', () => {
    const trunks = [
      trunk(6, 'Patton_0b1cdd_isdn_1', true),
      trunk(5, 'Patton_0b1cdd_isdn_0'),
      trunk(2, 'main_trunk'),
    ]
    const lines = getGatewayCallLines(gateway([5, 6, 9]), trunks)

    expect(lines).toEqual([
      { trunkId: 5, name: 'Patton_0b1cdd_isdn_0', disabled: false },
      { trunkId: 6, name: 'Patton_0b1cdd_isdn_1', disabled: true },
    ])
    expect(getCallableLines(lines)).toEqual([lines[0]])
    expect(getGatewayCallLines(gateway([]), trunks)).toEqual([])
  })

  it('reads the port of a gateway line', () => {
    expect(getGatewayLinePort('Grandstream_334455_fxo_2')).toEqual({ type: 'FXO', port: '2' })
    expect(getGatewayLinePort('Patton_0b1cdd_isdn_0')).toEqual({ type: 'ISDN', port: '0' })
    expect(getGatewayLinePort('main_trunk')).toBeNull()
  })
})

describe('getTrunkCallStatus', () => {
  it('follows the administrator phone', () => {
    expect(getTrunkCallStatus(context())).toBe('ready')
    expect(getTrunkCallStatus(context({ inCall: true }))).toBe('in_call')
    expect(getTrunkCallStatus(context({ phoneState: 'elsewhere', otherTabInCall: true }))).toBe(
      'in_call_elsewhere',
    )
    expect(getTrunkCallStatus(context({ phoneState: 'elsewhere' }))).toBe('elsewhere')
    expect(getTrunkCallStatus(context({ phoneState: 'error' }))).toBe('connection_lost')
    expect(getTrunkCallStatus(context({ phoneState: 'error', phoneEnabled: false }))).toBe(
      'phone_error',
    )
    expect(getTrunkCallStatus(context({ phoneState: 'registering' }))).toBe('connecting')
    expect(getTrunkCallStatus(context({ phoneState: 'inactive', phoneEnabled: false }))).toBe(
      'connecting',
    )
  })

  it('blocks calls only while the phone cannot take them', () => {
    expect(isTrunkCallBlocked('in_call')).toBe(true)
    expect(isTrunkCallBlocked('in_call_elsewhere')).toBe(true)
    expect(isTrunkCallBlocked('connection_lost')).toBe(true)
    expect(isTrunkCallBlocked('phone_error')).toBe(false)
    expect(isTrunkCallBlocked('elsewhere')).toBe(false)
    expect(isTrunkCallBlocked('connecting')).toBe(false)
    expect(isTrunkCallBlocked('ready')).toBe(false)
  })
})
