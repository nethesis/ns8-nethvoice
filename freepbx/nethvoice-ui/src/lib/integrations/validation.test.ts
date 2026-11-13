//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { HttpUrlSchema, PortSchema, requiredText, validateForm } from './validation'

describe('validateForm', () => {
  const schema = v.object({
    name: requiredText('name_required'),
    port: PortSchema,
    url: HttpUrlSchema('url_required', 'url_invalid'),
  })

  it('should return no issues for a valid form', () => {
    expect(
      validateForm(schema, { name: 'crm', port: '3306', url: 'https://crm.example.com' }),
    ).toEqual({})
  })

  it('should return the first message of each invalid field', () => {
    expect(validateForm(schema, { name: '  ', port: '', url: 'ftp://crm.example.com' })).toEqual({
      name: 'name_required',
      port: 'integrations.port_required',
      url: 'url_invalid',
    })
  })

  it('should reject ports outside the valid range', () => {
    const issues = (port: string) =>
      validateForm(schema, { name: 'crm', port, url: 'http://crm.example.com' })

    expect(issues('0')).toEqual({ port: 'integrations.port_invalid' })
    expect(issues('65536')).toEqual({ port: 'integrations.port_invalid' })
    expect(issues('33o6')).toEqual({ port: 'integrations.port_invalid' })
    expect(issues('65535')).toEqual({})
  })

  it('should accept URLs carrying placeholders and reject spaces', () => {
    const issues = (url: string) => validateForm(schema, { name: 'crm', port: '443', url })

    expect(issues('https://crm.example.com/open?number=$CALLER_NUMBER&name=$CALLER_NAME')).toEqual(
      {},
    )
    expect(issues('https://crm.example.com/open page')).toEqual({ url: 'url_invalid' })
    expect(issues('')).toEqual({ url: 'url_required' })
  })
})
