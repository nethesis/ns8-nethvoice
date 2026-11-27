//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  describeIntegrationError,
  getLegacyStatusMessage,
  getServerErrorField,
  getServerMessageKey,
} from './errors'

const apiError = (body: unknown) =>
  new ApiError({ status: 400, method: 'POST', url: '/freepbx/rest/phonebook/config', body })

describe('getLegacyStatusMessage', () => {
  it('should read the message of a legacy error body', () => {
    expect(getLegacyStatusMessage(apiError({ status: 'Missing value: host' }))).toBe(
      'Missing value: host',
    )
  })

  it('should not read the message of a server error', () => {
    expect(
      getLegacyStatusMessage(
        new ApiError({
          status: 500,
          method: 'POST',
          url: '/freepbx/rest/phonebook/config',
          body: { status: 'Cannot write the phonebook configuration' },
        }),
      ),
    ).toBe('')
  })

  it('should ignore a boolean status', () => {
    expect(getLegacyStatusMessage(apiError({ status: false }))).toBe('')
  })

  it('should ignore other errors and bodies', () => {
    expect(getLegacyStatusMessage(apiError(null))).toBe('')
    expect(getLegacyStatusMessage(apiError('plain text'))).toBe('')
    expect(getLegacyStatusMessage(new Error('Missing value: host'))).toBe('')
  })
})

describe('server messages of the CTI routes', () => {
  const ctiError = (body: unknown, status = 400) =>
    new ApiError({ status, method: 'POST', url: '/freepbx/rest/cti/dbconn', body })

  it('should map the known English messages to translation keys', () => {
    expect(
      getServerMessageKey(
        ctiError({ message: 'Enter the password to connect to a different server' }),
      ),
    ).toBe('integrations.password_server_changed_error')
    expect(getServerMessageKey(ctiError({ message: 'Missing value: host' }))).toBe(
      'integrations.missing_value',
    )
    expect(
      getServerMessageKey(
        ctiError({ message: 'Customer card name already in use', field: 'name' }, 409),
      ),
    ).toBe('integrations.cards.card_name_in_use')
    expect(getServerMessageKey(ctiError({ message: 'Something new' }))).toBe('')
    expect(
      getServerMessageKey(ctiError({ message: 'Invalid database connection fields' }, 500)),
    ).toBe('')
  })

  it('should read the field named by the server', () => {
    expect(getServerErrorField(ctiError({ message: 'x', field: 'host' }, 403))).toBe('host')
    expect(getServerErrorField(ctiError({ message: 'x' }))).toBe('')
    expect(getServerErrorField(ctiError({ field: 'host' }, 500))).toBe('')
  })

  it('should never show the English text of a known message', () => {
    const text = describeIntegrationError(
      ctiError({ message: 'Enter the password to connect to a different server' }),
    )

    expect(text).toBe('Enter the password again to connect to a different server.')
    expect(
      describeIntegrationError(ctiError({ message: 'Database connection not found' }, 404)),
    ).not.toContain('Database connection not found')
  })
})
