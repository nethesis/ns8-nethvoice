//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildParameterizedUrlDeletePayload,
  buildParameterizedUrlPayload,
  getBusyProfileIds,
  getReleasedProfilesPayload,
  type ParameterizedUrlForm,
  parseParameterizedUrls,
  toParameterizedUrlForm,
  validateParameterizedUrlForm,
} from './parameterizedUrls'

const rawUrls = [
  {
    id: 7,
    url: 'https://support.example.com/ticket?caller=$CALLER_NUMBER',
    profiles: '3',
    only_queues: true,
  },
  {
    id: 4,
    url: 'https://crm.example.com/open?number=$CALLER_NUMBER',
    profiles: '1,2',
    only_queues: false,
  },
]

const urls = () => parseParameterizedUrls(rawUrls)

const form = (changes: Partial<ParameterizedUrlForm> = {}): ParameterizedUrlForm => ({
  url: 'https://crm.example.com/open?number=$CALLER_NUMBER',
  profileIds: ['2', '1'],
  onlyQueues: false,
  ...changes,
})

describe('parseParameterizedUrls', () => {
  it('should split the profiles and sort by URL', () => {
    expect(urls()).toEqual([
      {
        id: '4',
        url: 'https://crm.example.com/open?number=$CALLER_NUMBER',
        profileIds: ['1', '2'],
        onlyQueues: false,
      },
      {
        id: '7',
        url: 'https://support.example.com/ticket?caller=$CALLER_NUMBER',
        profileIds: ['3'],
        onlyQueues: true,
      },
    ])
  })

  it('should accept an empty list and the numeric flag of older servers', () => {
    expect(parseParameterizedUrls([])).toEqual([])
    expect(
      parseParameterizedUrls([
        { id: '1', url: 'https://a.example.com', profiles: null, only_queues: '1' },
      ]),
    ).toEqual([{ id: '1', url: 'https://a.example.com', profileIds: [], onlyQueues: true }])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseParameterizedUrls({})).toThrow()
  })
})

describe('getBusyProfileIds', () => {
  it('should list the profiles bound to the other URLs', () => {
    expect(getBusyProfileIds(urls())).toEqual(['1', '2', '3'])
    expect(getBusyProfileIds(urls(), urls()[0])).toEqual(['3'])
  })
})

describe('validateParameterizedUrlForm', () => {
  it('should accept a valid URL with profiles', () => {
    expect(validateParameterizedUrlForm(form(), [])).toEqual({})
  })

  it('should require URL and profiles', () => {
    expect(validateParameterizedUrlForm(form({ url: '', profileIds: [] }), [])).toEqual({
      url: 'integrations.url_required',
      profileIds: 'integrations.profiles_required',
    })
  })

  it('should reject malformed and oversized URLs', () => {
    expect(validateParameterizedUrlForm(form({ url: 'crm.example.com' }), [])).toEqual({
      url: 'integrations.url_invalid',
    })
    expect(
      validateParameterizedUrlForm(form({ url: `https://crm.example.com/${'a'.repeat(240)}` }), []),
    ).toEqual({ url: 'integrations.param_urls.url_too_long' })
  })

  it('should reject a URL that another entry already uses', () => {
    expect(validateParameterizedUrlForm(form(), [urls()[0]])).toEqual({
      url: 'integrations.param_urls.url_already_used',
    })
  })
})

describe('payloads', () => {
  it('should build the body of a new URL', () => {
    expect(
      buildParameterizedUrlPayload(
        form({ url: ' https://crm.example.com/open ', onlyQueues: true }),
      ),
    ).toEqual({ url: 'https://crm.example.com/open', profiles: [1, 2], only_queues: true })
  })

  it('should carry the id when editing', () => {
    expect(buildParameterizedUrlPayload(form(), urls()[0])).toEqual({
      id: '4',
      url: 'https://crm.example.com/open?number=$CALLER_NUMBER',
      profiles: [1, 2],
      only_queues: false,
    })
  })

  it('should build the body that removes a URL', () => {
    expect(buildParameterizedUrlDeletePayload(urls()[0])).toEqual({
      url: 'https://crm.example.com/open?number=$CALLER_NUMBER',
      profiles: [1, 2],
    })
  })

  it('should fill the form from an entry', () => {
    expect(toParameterizedUrlForm(urls()[1])).toEqual({
      url: 'https://support.example.com/ticket?caller=$CALLER_NUMBER',
      profileIds: ['3'],
      onlyQueues: true,
    })
  })
})

describe('getReleasedProfilesPayload', () => {
  it('should release the removed profiles from the previous URL when the URL changes', () => {
    expect(
      getReleasedProfilesPayload(
        form({ url: 'https://crm.example.com/v2', profileIds: ['1'] }),
        urls()[0],
      ),
    ).toEqual({ url: 'https://crm.example.com/open?number=$CALLER_NUMBER', profiles: [2] })
  })

  it('should leave the cleanup to the server when the URL is unchanged', () => {
    expect(getReleasedProfilesPayload(form({ profileIds: ['1'] }), urls()[0])).toBeNull()
  })

  it('should do nothing when no profile was removed', () => {
    expect(
      getReleasedProfilesPayload(
        form({ url: 'https://crm.example.com/v2', profileIds: ['1', '2', '3'] }),
        urls()[0],
      ),
    ).toBeNull()
  })
})
