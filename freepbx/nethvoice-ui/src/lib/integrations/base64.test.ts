//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { decodeBase64Utf8, encodeBase64Utf8 } from './base64'

describe('encodeBase64Utf8', () => {
  it('should encode plain text', () => {
    expect(encodeBase64Utf8('select * from phonebook')).toBe('c2VsZWN0ICogZnJvbSBwaG9uZWJvb2s=')
  })

  it('should encode characters outside latin1', () => {
    expect(encodeBase64Utf8('città €')).toBe('Y2l0dMOgIOKCrA==')
  })
})

describe('decodeBase64Utf8', () => {
  it('should restore what was encoded', () => {
    expect(decodeBase64Utf8(encodeBase64Utf8('<p>città €</p>'))).toBe('<p>città €</p>')
  })

  it('should ignore the line breaks added by the server', () => {
    expect(decodeBase64Utf8('c2VsZWN0ICogZnJv\r\nbSBwaG9uZWJvb2s=\r\n')).toBe(
      'select * from phonebook',
    )
  })

  it('should return an empty string for malformed input', () => {
    expect(decodeBase64Utf8('%%%')).toBe('')
  })
})
