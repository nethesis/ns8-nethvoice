//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { PHONE_LANGUAGES, PHONE_TONE_ZONES } from './defaults'
import type { ModelVariables, ModelVariablesPatch } from './models'

export type ModelSectionId =
  'soft_keys' | 'line_keys' | 'display' | 'preferences' | 'ldap' | 'network'

export type ModelOption = {
  id: string
  label?: string
  labelKey?: string
  count?: number
}

export type ModelFileType = 'backgrounds' | 'firmware'

export type ModelField = {
  variable: string
  labelKey: string
  type: 'text' | 'password' | 'select' | 'file'
  options?: ModelOption[]
  optionsKind?: 'language' | 'tone_zone'
  fileType?: ModelFileType
}

export type ModelKeyPrefix = 'softkey' | 'linekey'

export type ModelKeys = {
  prefix: ModelKeyPrefix
  count: number
  typeOptions: ModelOption[]
}

export type ModelSection = {
  id: ModelSectionId
  fields: ModelField[]
  keys?: ModelKeys
}

const SOFT_KEY_TYPES = [
  'forward',
  'dnd',
  'recall',
  'pick_up',
  'speed_dial',
  'group_pickup',
  'history',
  'menu',
  'status',
  'prefix',
  'ldap',
]

const LINE_KEY_TYPES = [
  'conference',
  'forward',
  'transfer',
  'hold',
  'dnd',
  'recall',
  'direct_pickup',
  'dtmf',
  'queuetoggle',
  'voice_mail',
  'speed_dial',
  'line',
  'blf',
  'url',
  'group_pickup',
  'multicast_paging',
  'record',
  'prefix',
  'phone_lock',
  'ldap',
]

const TIMEOUTS = [3, 5, 7, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 2400, 3000, 3600]

const DATE_FORMATS = [
  'DD MM YY',
  'DD MM YYYY',
  'DD MMM WW',
  'DD MMM YY',
  'DD MMM YYYY',
  'WWW DD MMM',
  'WWW MMM DD',
  'MM DD YYYY',
  'MMM DD WW',
  'YY MM DD',
  'YYYY MM DD',
  'MM DD YY',
]

const LLDP_TEMPLATES = [
  'yealink.tmpl',
  'snom.tmpl',
  'snomD8XX.tmpl',
  'gigasetP.tmpl',
  'gigasetP8XX.tmpl',
  'akuvox.tmpl',
  'akuvox410w.tmpl',
  'akuvox480w.tmpl',
  'fanvil-X3.tmpl',
  'fanvil-X5.tmpl',
  'fanvil-V67.tmpl',
  'nethesis.tmpl',
  'sangoma.tmpl',
]

const LDAP_TEXT_VARIABLES = [
  'ldap_base',
  'ldap_name_filter',
  'ldap_number_filter',
  'ldap_name_attr',
  'ldap_name_display',
  'ldap_mainphone_number_attr',
  'ldap_mobilephone_number_attr',
  'ldap_otherphone_number_attr',
]

const CUSTOM_RINGTONE = '-1'
const SILENT_RINGTONE = '0'
const LEVELS_COUNT = 10

const parseList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')

const parseCount = (value: string | undefined): number => {
  const count = Number.parseInt(value ?? '', 10)
  return Number.isFinite(count) && count > 0 ? count : 0
}

const literalOptions = (values: string[]): ModelOption[] =>
  values.map((value) => ({ id: value, label: value }))

const keyedOptions = (values: string[], prefix: string): ModelOption[] =>
  values.map((value) => ({ id: value, labelKey: `${prefix}.${value}` }))

const withoutBlacklisted = (options: ModelOption[], blacklist: string[], current: string) =>
  options.filter((option) => option.id === current || !blacklist.includes(option.id))

export const getTimeoutOption = (seconds: number, zeroLabelKey: string): ModelOption => {
  if (seconds === 0) {
    return { id: '0', labelKey: zeroLabelKey }
  }

  if (seconds < 60) {
    return { id: String(seconds), labelKey: 'phones.models.n_seconds', count: seconds }
  }

  if (seconds < 3600) {
    return { id: String(seconds), labelKey: 'phones.models.n_minutes', count: seconds / 60 }
  }
  return { id: String(seconds), labelKey: 'phones.models.n_hours', count: seconds / 3600 }
}

const getTimeoutOptions = (zeroLabelKey: string): ModelOption[] =>
  [...TIMEOUTS, 0].map((seconds) => getTimeoutOption(seconds, zeroLabelKey))

export const getRingtoneOptions = (variables: ModelVariables): ModelOption[] => {
  const count = parseCount(variables.cap_ringtone_count)
  const blacklist = parseList(variables.cap_ringtone_blacklist)
  const current = variables.ringtone ?? ''
  const options: ModelOption[] = []

  if (current === CUSTOM_RINGTONE) {
    options.push({ id: CUSTOM_RINGTONE, labelKey: 'phones.models.ringtone_custom' })
  }

  if (current === SILENT_RINGTONE || !blacklist.includes(SILENT_RINGTONE)) {
    options.push({ id: SILENT_RINGTONE, labelKey: 'phones.models.ringtone_silent' })
  }

  for (let ringtone = 1; ringtone <= count; ringtone += 1) {
    const id = String(ringtone)

    if (id === current || !blacklist.includes(id)) {
      options.push({ id, label: id })
    }
  }
  return options
}

const getLevelOptions = (): ModelOption[] =>
  literalOptions(Array.from({ length: LEVELS_COUNT }, (_, level) => String(level)))

export const getTimeZones = (current: string): string[] => {
  const zones =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  const withUtc = zones.includes('UTC') ? zones : [...zones, 'UTC']

  return current && !withUtc.includes(current) ? [...withUtc, current] : withUtc
}

const getKeys = (variables: ModelVariables, prefix: ModelKeyPrefix): ModelKeys | undefined => {
  const count = parseCount(variables[`cap_${prefix}_count`])

  if (count === 0) {
    return undefined
  }
  const blacklist = parseList(variables[`cap_${prefix}_type_blacklist`])
  const types = (prefix === 'softkey' ? SOFT_KEY_TYPES : LINE_KEY_TYPES).filter(
    (type) => !blacklist.includes(type),
  )

  return {
    prefix,
    count,
    typeOptions: [
      { id: '', labelKey: 'phones.models.key_types.none' },
      ...keyedOptions(types, 'phones.models.key_types'),
    ],
  }
}

const getDisplayFields = (variables: ModelVariables): ModelField[] => {
  const fields: ModelField[] = [
    {
      variable: 'ringtone',
      labelKey: 'phones.models.ringtone',
      type: 'select',
      options: getRingtoneOptions(variables),
    },
  ]
  const screensaverBlacklist = parseList(variables.cap_screensaver_time_blacklist)
  const backlightBlacklist = parseList(variables.cap_backlight_time_blacklist)
  const screensaverOptions = withoutBlacklisted(
    getTimeoutOptions('phones.models.timeout_disabled'),
    screensaverBlacklist,
    variables.screensaver_time ?? '',
  )
  const backlightOptions = withoutBlacklisted(
    getTimeoutOptions('phones.models.timeout_always_on'),
    backlightBlacklist,
    variables.backlight_time ?? '',
  )

  if (screensaverBlacklist.length <= TIMEOUTS.length) {
    fields.push({
      variable: 'screensaver_time',
      labelKey: 'phones.models.screensaver_timeout',
      type: 'select',
      options: screensaverOptions,
    })
  }

  if (backlightBlacklist.length <= TIMEOUTS.length) {
    fields.push({
      variable: 'backlight_time',
      labelKey: 'phones.models.backlight_timeout',
      type: 'select',
      options: backlightOptions,
    })
  }

  if (variables.cap_brightness === '1') {
    fields.push({
      variable: 'brightness',
      labelKey: 'phones.models.display_brightness',
      type: 'select',
      options: getLevelOptions(),
    })
  }

  if (variables.cap_contrast === '1') {
    fields.push({
      variable: 'contrast',
      labelKey: 'phones.models.display_contrast',
      type: 'select',
      options: getLevelOptions(),
    })
  }

  if (variables.cap_background_file === '1') {
    fields.push({
      variable: 'background_file',
      labelKey: 'phones.models.background_image',
      type: 'file',
      fileType: 'backgrounds',
    })
  }
  return fields
}

const getPreferencesFields = (variables: ModelVariables): ModelField[] => [
  { variable: 'ntp_server', labelKey: 'phones.models.ntp_server', type: 'text' },
  {
    variable: 'provisioning_freq',
    labelKey: 'phones.settings.provisioning_schedule',
    type: 'select',
    options: [
      { id: 'everyday', labelKey: 'phones.settings.every_day' },
      { id: 'never', labelKey: 'phones.settings.only_at_startup' },
    ],
  },
  {
    variable: 'dss_transfer',
    labelKey: 'phones.models.dss_transfer',
    type: 'select',
    options: withoutBlacklisted(
      keyedOptions(['verify', 'attended', 'blind'], 'phones.models.dss_transfer_modes'),
      parseList(variables.cap_dss_transfer_blacklist),
      variables.dss_transfer ?? '',
    ),
  },
  {
    variable: 'language',
    labelKey: 'phones.settings.phone_language',
    type: 'select',
    optionsKind: 'language',
    options: literalOptions(PHONE_LANGUAGES),
  },
  {
    variable: 'timezone',
    labelKey: 'phones.models.time_zone',
    type: 'select',
    options: literalOptions(getTimeZones(variables.timezone ?? '')),
  },
  {
    variable: 'tonezone',
    labelKey: 'phones.settings.tone_region',
    type: 'select',
    optionsKind: 'tone_zone',
    options: literalOptions(PHONE_TONE_ZONES),
  },
  {
    variable: 'time_format',
    labelKey: 'phones.models.time_format',
    type: 'select',
    options: [
      { id: '12', labelKey: 'phones.models.time_format_12' },
      { id: '24', labelKey: 'phones.models.time_format_24' },
    ],
  },
  {
    variable: 'date_format',
    labelKey: 'phones.models.date_format',
    type: 'select',
    options: withoutBlacklisted(
      literalOptions(DATE_FORMATS),
      parseList(variables.cap_date_format_blacklist),
      variables.date_format ?? '',
    ),
  },
  {
    variable: 'firmware_file',
    labelKey: 'phones.models.firmware',
    type: 'file',
    fileType: 'firmware',
  },
]

const getLdapFields = (variables: ModelVariables): ModelField[] => [
  { variable: 'ldap_server', labelKey: 'phones.models.ldap.ldap_server', type: 'text' },
  { variable: 'ldap_port', labelKey: 'phones.models.ldap.ldap_port', type: 'text' },
  { variable: 'ldap_user', labelKey: 'phones.models.ldap.ldap_user', type: 'text' },
  { variable: 'ldap_password', labelKey: 'phones.models.ldap.ldap_password', type: 'password' },
  {
    variable: 'ldap_tls',
    labelKey: 'phones.models.ldap.ldap_tls',
    type: 'select',
    options: withoutBlacklisted(
      keyedOptions(['none', 'starttls', 'ldaps'], 'phones.models.ldap.tls_modes'),
      parseList(variables.cap_ldap_tls_blacklist),
      variables.ldap_tls ?? '',
    ),
  },
  ...LDAP_TEXT_VARIABLES.map((variable): ModelField => ({
    variable,
    labelKey: `phones.models.ldap.${variable}`,
    type: 'text',
  })),
]

const getNetworkFields = (variables: ModelVariables): ModelField[] => {
  const fields: ModelField[] = []

  if (LLDP_TEMPLATES.includes(variables.tmpl_phone ?? '')) {
    fields.push({
      variable: 'lldp_enable',
      labelKey: 'phones.models.lldp',
      type: 'select',
      options: [
        { id: '1', labelKey: 'common.enabled' },
        { id: '0', labelKey: 'common.disabled' },
      ],
    })
  }

  return [
    ...fields,
    { variable: 'vlan_id_phone', labelKey: 'phones.models.vlan_id_phone', type: 'text' },
    { variable: 'vlan_id_pcport', labelKey: 'phones.models.vlan_id_pc_port', type: 'text' },
  ]
}

export const getModelSections = (variables: ModelVariables): ModelSection[] => {
  const sections: ModelSection[] = []
  const softKeys = getKeys(variables, 'softkey')
  const lineKeys = getKeys(variables, 'linekey')

  if (softKeys) {
    sections.push({ id: 'soft_keys', fields: [], keys: softKeys })
  }

  if (lineKeys) {
    sections.push({ id: 'line_keys', fields: [], keys: lineKeys })
  }

  return [
    ...sections,
    { id: 'display', fields: getDisplayFields(variables) },
    { id: 'preferences', fields: getPreferencesFields(variables) },
    { id: 'ldap', fields: getLdapFields(variables) },
    { id: 'network', fields: getNetworkFields(variables) },
  ]
}

export const getKeyVariables = (prefix: ModelKeyPrefix, index: number) => ({
  type: `${prefix}_type_${index}`,
  value: `${prefix}_value_${index}`,
  label: `${prefix}_label_${index}`,
})

export const getSectionVariables = (section: ModelSection): string[] => {
  const variables = section.fields.map((field) => field.variable)

  if (section.keys) {
    for (let index = 1; index <= section.keys.count; index += 1) {
      variables.push(...Object.values(getKeyVariables(section.keys.prefix, index)))
    }
  }
  return variables
}

export const getEffectiveVariables = (
  modelVariables: ModelVariables,
  defaults: ModelVariables,
): ModelVariables => ({ ...defaults, ...modelVariables })

export const buildModelForm = (
  sections: ModelSection[],
  effectiveVariables: ModelVariables,
): ModelVariables => {
  const form: ModelVariables = {}

  for (const section of sections) {
    for (const variable of getSectionVariables(section)) {
      form[variable] = effectiveVariables[variable] ?? ''
    }
  }
  return form
}

export const buildVariablesPatch = (
  initial: ModelVariables,
  current: ModelVariables,
): ModelVariablesPatch => {
  const patch: ModelVariablesPatch = {}

  for (const [variable, value] of Object.entries(current)) {
    if (value !== (initial[variable] ?? '')) {
      patch[variable] = value === '' ? null : value
    }
  }
  return patch
}

export const countSectionChanges = (
  section: ModelSection,
  initial: ModelVariables,
  current: ModelVariables,
): number =>
  getSectionVariables(section).filter(
    (variable) => (current[variable] ?? '') !== (initial[variable] ?? ''),
  ).length
