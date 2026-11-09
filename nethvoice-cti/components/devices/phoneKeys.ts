// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { t } from 'i18next'
import { openToast } from '../../lib/utils'

export interface PhoneKeyType {
  value: string
  label: string
  badge: string
}

export const PHONE_KEY_TYPES: PhoneKeyType[] = [
  { value: 'blf', label: 'Devices.Key type blf', badge: 'Devices.BLF' },
  { value: 'line', label: 'Devices.Key type line', badge: 'Devices.LINE' },
  { value: 'dnd', label: 'Devices.Key type dnd', badge: 'Devices.DND' },
  { value: 'speed_dial', label: 'Devices.Key type speed dial', badge: 'Devices.SPEED DIAL' },
  { value: 'queuetoggle', label: 'Devices.Key type queue', badge: 'Devices.QUEUE' },
]

export const PHONE_KEY_TYPES_WITHOUT_VALUE = ['line', 'dnd', 'queuetoggle']

const LEGACY_PHONE_KEY_TYPES: { [key: string]: string } = { toggleQueue: 'queuetoggle' }

export const normalizePhoneKeyType = (type: string) => LEGACY_PHONE_KEY_TYPES[type] || type

export const isPhoneKeyTypeWithValue = (type: string) =>
  type !== '' && !PHONE_KEY_TYPES_WITHOUT_VALUE.includes(type)

export const getDefaultPhoneKeyLabel = (type: string) => {
  if (!PHONE_KEY_TYPES_WITHOUT_VALUE.includes(type)) {
    return ''
  }
  const keyType = PHONE_KEY_TYPES.find((item) => item.value === type)
  return keyType ? t(keyType.label) : ''
}

export const getPhoneKeyTargetText = (value: string, label: string) => {
  if (!value) {
    return label
  }
  if (!label || label === value) {
    return value
  }
  return `${value} - ${label}`
}

export const generateRandomPin = () =>
  Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')

export const notifyPhoneConfigurationSaved = (phoneName: string) => {
  openToast(
    'success',
    `${t('Devices.Phone configuration saved description', { name: phoneName })}`,
    `${t('Devices.Configuration saved')}`,
  )
}

export const PHONE_KEY_CARD_CLASSES =
  'rounded-lg border-b border-layoutDivider dark:border-layoutDividerDark bg-elevationL2Invert dark:bg-elevationL2InvertDark shadow'

export const EXPANSION_KEY_CARD_CLASSES =
  'rounded-lg bg-elevationL2Invert dark:bg-elevationL2InvertDark shadow-md'

export const PHONE_KEY_LABEL_CLASSES =
  'text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'
