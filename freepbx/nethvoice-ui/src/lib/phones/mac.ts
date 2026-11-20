//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { tancredi } from './tancrediClient'

export const MAC_VENDORS_KEY = 'phoneMacVendors'

export type MacVendors = Record<string, string>

const MacVendorsResponseSchema = v.record(v.string(), v.string())

const stripSeparators = (mac: string) => mac.trim().replace(/[:.-]/g, '')

const toPairs = (hex: string) => hex.match(/.{2}/g) ?? []

export const isValidMac = (mac: string): boolean => /^[0-9a-fA-F]{12}$/.test(stripSeparators(mac))

export const isUnicastMac = (mac: string): boolean => {
  if (!isValidMac(mac)) {
    return false
  }
  const hex = stripSeparators(mac)
  return (parseInt(hex.slice(0, 2), 16) & 1) === 0 && !/^0+$/.test(hex)
}

export const toTancrediMac = (mac: string): string =>
  toPairs(stripSeparators(mac).toUpperCase()).join('-')

export const formatMac = (mac: string): string =>
  isValidMac(mac) ? toPairs(stripSeparators(mac).toUpperCase()).join(':') : mac.trim()

const SPACED_OCTETS_REGEX = /^[0-9a-fA-F]{2}(\s+[0-9a-fA-F]{2}){5}$/

export const parseMacList = (text: string): string[] =>
  text
    .split(/[\r\n,;]+/)
    .map((segment) => segment.trim())
    .flatMap((segment) =>
      SPACED_OCTETS_REGEX.test(segment) ? [segment.replace(/\s+/g, ':')] : segment.split(/\s+/),
    )
    .filter((mac) => mac !== '')

export const findDuplicatedMacs = (macs: string[]): string[] => {
  const seen = new Set<string>()
  const duplicated = new Set<string>()

  for (const mac of macs) {
    if (!isValidMac(mac)) {
      continue
    }
    const normalized = toTancrediMac(mac)

    if (seen.has(normalized)) {
      duplicated.add(normalized)
    }
    seen.add(normalized)
  }
  return [...duplicated]
}

export const parseMacVendors = (raw: unknown): MacVendors => {
  const vendors: MacVendors = {}

  for (const [prefix, vendor] of Object.entries(v.parse(MacVendorsResponseSchema, raw ?? {}))) {
    vendors[stripSeparators(prefix).toUpperCase()] = vendor.toLowerCase()
  }
  return vendors
}

export const getMacVendor = (mac: string, vendors: MacVendors): string => {
  if (!isValidMac(mac)) {
    return ''
  }
  return vendors[stripSeparators(mac).toUpperCase().slice(0, 6)] ?? ''
}

export const getMacVendors = async (): Promise<MacVendors> =>
  parseMacVendors(await tancredi.get('/macvendors'))
