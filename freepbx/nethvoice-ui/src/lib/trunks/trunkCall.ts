//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { AdminPhoneState } from '@/lib/adminPhone/adminPhone'
import type { Trunk } from './trunks'
import type { Gateway } from './gateways'

export const TRUNK_CALL_PREFIX = '***'

export const TRUNK_CALL_NUMBER_MAX_LENGTH = 30

const TRUNK_CALL_NUMBER_PATTERN = /^\+?[0-9]+$/

const TRUNK_CALL_NUMBER_SEPARATORS = /[\s().\-/]/g

export type TrunkCallLine = { trunkId: number; name: string; disabled: boolean }

export type TrunkCallStatus =
  | 'in_call'
  | 'in_call_elsewhere'
  | 'connection_lost'
  | 'phone_error'
  | 'elsewhere'
  | 'ready'
  | 'connecting'

export type TrunkCallContext = {
  phoneState: AdminPhoneState
  phoneEnabled: boolean
  inCall: boolean
  otherTabInCall: boolean
}

const BLOCKING_STATUSES: TrunkCallStatus[] = ['in_call', 'in_call_elsewhere', 'connection_lost']

export const normalizeTrunkCallNumber = (value: string): string =>
  value.replace(TRUNK_CALL_NUMBER_SEPARATORS, '')

export const validateTrunkCallNumber = (value: string): string => {
  const number = normalizeTrunkCallNumber(value)

  if (!number) {
    return 'trunks.call.number_required'
  }
  if (!TRUNK_CALL_NUMBER_PATTERN.test(number)) {
    return 'trunks.call.number_invalid'
  }
  if (number.replace('+', '').length > TRUNK_CALL_NUMBER_MAX_LENGTH) {
    return 'trunks.call.number_too_long'
  }
  return ''
}

export const getTrunkCallDestination = (trunkId: number, value: string): string =>
  `${TRUNK_CALL_PREFIX}${trunkId}*${normalizeTrunkCallNumber(value)}`

export const getTrunkCallLines = (trunk: Trunk): TrunkCallLine[] => [
  { trunkId: trunk.id, name: trunk.name, disabled: trunk.disabled },
]

export const getGatewayCallLines = (gateway: Gateway, trunks: Trunk[]): TrunkCallLine[] =>
  gateway.trunkIds.flatMap((trunkId) => {
    const trunk = trunks.find((item) => item.id === trunkId)
    return trunk ? [{ trunkId, name: trunk.name, disabled: trunk.disabled }] : []
  })

export const getCallableLines = (lines: TrunkCallLine[]): TrunkCallLine[] =>
  lines.filter((line) => !line.disabled)

export const getTrunkCallStatus = (context: TrunkCallContext): TrunkCallStatus => {
  if (context.inCall) {
    return 'in_call'
  }
  if (context.phoneState === 'elsewhere' && context.otherTabInCall) {
    return 'in_call_elsewhere'
  }
  switch (context.phoneState) {
    case 'error':
      return context.phoneEnabled ? 'connection_lost' : 'phone_error'
    case 'elsewhere':
      return 'elsewhere'
    case 'ready':
      return 'ready'
    default:
      return 'connecting'
  }
}

export const isTrunkCallBlocked = (status: TrunkCallStatus): boolean =>
  BLOCKING_STATUSES.includes(status)

const GATEWAY_LINE_PATTERN = /_(isdn|pri|fxo)_(\d+)$/i

export const getGatewayLinePort = (name: string): { type: string; port: string } | null => {
  const match = GATEWAY_LINE_PATTERN.exec(name)
  return match ? { type: match[1].toUpperCase(), port: match[2] } : null
}
