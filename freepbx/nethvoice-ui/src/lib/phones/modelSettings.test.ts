//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildModelForm,
  buildVariablesPatch,
  countSectionChanges,
  getEffectiveVariables,
  getModelSections,
  getRingtoneOptions,
  getSectionVariables,
  getTimeoutOption,
} from './modelSettings'

const variables = {
  tmpl_phone: 'fanvil-X5.tmpl',
  cap_softkey_count: '2',
  cap_softkey_type_blacklist: 'status',
  cap_linekey_count: '',
  cap_ringtone_count: '3',
  cap_ringtone_blacklist: '-1',
  cap_brightness: '1',
  cap_contrast: '',
  cap_background_file: '1',
  ringtone: '1',
}

describe('getModelSections', () => {
  const sections = getModelSections(variables)

  it('should include only the sections the model supports', () => {
    expect(sections.map((section) => section.id)).toEqual([
      'soft_keys',
      'display',
      'preferences',
      'ldap',
      'network',
    ])
  })

  it('should drop blacklisted key types', () => {
    const softKeys = sections[0].keys

    expect(softKeys?.count).toBe(2)
    expect(softKeys?.typeOptions.map((option) => option.id)).not.toContain('status')
    expect(softKeys?.typeOptions[0].id).toBe('')
  })

  it('should show display fields by capability', () => {
    const display = sections.find((section) => section.id === 'display')

    expect(display?.fields.map((field) => field.variable)).toEqual([
      'ringtone',
      'screensaver_time',
      'backlight_time',
      'brightness',
      'background_file',
    ])
  })

  it('should show LLDP only for templates that support it', () => {
    const network = (vars: Record<string, string>) =>
      getModelSections(vars)
        .find((section) => section.id === 'network')
        ?.fields.map((field) => field.variable)

    expect(network(variables)).toContain('lldp_enable')
    expect(network({ tmpl_phone: 'other.tmpl' })).not.toContain('lldp_enable')
  })
})

describe('getRingtoneOptions', () => {
  it('should list silent and numbered ringtones without blacklisted ones', () => {
    expect(getRingtoneOptions(variables).map((option) => option.id)).toEqual(['0', '1', '2', '3'])
  })

  it('should keep the custom ringtone when selected', () => {
    expect(getRingtoneOptions({ ...variables, ringtone: '-1' })[0].id).toBe('-1')
  })
})

describe('getTimeoutOption', () => {
  it('should express timeouts in the largest unit', () => {
    expect(getTimeoutOption(30, 'zero')).toMatchObject({ labelKey: 'phones.models.n_seconds' })
    expect(getTimeoutOption(600, 'zero')).toMatchObject({
      labelKey: 'phones.models.n_minutes',
      count: 10,
    })
    expect(getTimeoutOption(3600, 'zero')).toMatchObject({ count: 1 })
    expect(getTimeoutOption(0, 'zero')).toMatchObject({ labelKey: 'zero' })
  })
})

describe('model form', () => {
  const sections = getModelSections(variables)
  const effective = getEffectiveVariables(variables, { ringtone: '2', ntp_server: 'pool.ntp.org' })
  const form = buildModelForm(sections, effective)

  it('should start from model variables over the defaults', () => {
    expect(form.ringtone).toBe('1')
    expect(form.ntp_server).toBe('pool.ntp.org')
    expect(form.softkey_type_2).toBe('')
  })

  it('should send only changed variables and clear emptied ones', () => {
    const changed = { ...form, ringtone: '3', ntp_server: '' }

    expect(buildVariablesPatch(form, changed)).toEqual({ ringtone: '3', ntp_server: null })
    expect(countSectionChanges(sections[1], form, changed)).toBe(1)
  })

  it('should list the variables of a keys section', () => {
    expect(getSectionVariables(sections[0])).toEqual([
      'softkey_type_1',
      'softkey_value_1',
      'softkey_label_1',
      'softkey_type_2',
      'softkey_value_2',
      'softkey_label_2',
    ])
  })
})
