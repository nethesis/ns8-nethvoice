//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  areAllProfilesBound,
  buildParameterizedUrlDeletePayload,
  buildParameterizedUrlSavePlan,
  getAvailableProfiles,
  getProfileName,
  getRowsSharingUrl,
  type ParameterizedUrlForm,
  parseParameterizedUrls,
  sortParameterizedUrls,
  toDuplicatedParameterizedUrlForm,
  toParameterizedUrlForm,
  validateParameterizedUrlForm,
} from './parameterizedUrls'

const CRM = 'https://crm.example.com/open?number=$CALLER_NUMBER'
const SUPPORT = 'https://support.example.com/ticket?caller=$CALLER_NUMBER'

const rawUrls = [
  { id: 7, url: SUPPORT, profiles: '3', only_queues: true, names: { '3': 'Helpdesk ticket' } },
  {
    id: 4,
    url: CRM,
    profiles: '2,1',
    only_queues: false,
    names: { '1': 'CRM base', '2': 'CRM standard' },
  },
]

const PROFILES = [
  { id: '1', name: 'Standard' },
  { id: '2', name: 'Base' },
  { id: '3', name: 'Advanced' },
  { id: '5', name: 'Sales' },
]

const rows = () => parseParameterizedUrls(rawUrls)
const row = (profileId: string) => rows().find((item) => item.profileId === profileId)!

const form = (changes: Partial<ParameterizedUrlForm> = {}): ParameterizedUrlForm => ({
  name: 'ERP call',
  url: 'https://erp.example.com/call?from=$CALLER_NUMBER',
  profileId: '5',
  onlyQueues: false,
  ...changes,
})

describe('parseParameterizedUrls', () => {
  it('should return one row per profile with its name, sorted by name', () => {
    expect(rows()).toEqual([
      { id: '1', groupId: '4', name: 'CRM base', url: CRM, profileId: '1', onlyQueues: false },
      { id: '2', groupId: '4', name: 'CRM standard', url: CRM, profileId: '2', onlyQueues: false },
      {
        id: '3',
        groupId: '7',
        name: 'Helpdesk ticket',
        url: SUPPORT,
        profileId: '3',
        onlyQueues: true,
      },
    ])
  })

  it('should sort by name before URL', () => {
    expect(
      parseParameterizedUrls([
        { id: 1, url: CRM, profiles: '1', only_queues: false, names: { '1': 'Zendesk' } },
        { id: 2, url: SUPPORT, profiles: '2', only_queues: false, names: { '2': 'Accounting' } },
      ]).map((item) => item.name),
    ).toEqual(['Accounting', 'Zendesk'])
  })

  it('should accept an empty list, missing profiles and the numeric flag of older servers', () => {
    expect(parseParameterizedUrls([])).toEqual([])
    expect(
      parseParameterizedUrls([
        { id: '1', url: 'https://a.example.com', profiles: null, only_queues: '1' },
        { id: '2', url: 'https://b.example.com', profiles: '6', only_queues: 1 },
      ]),
    ).toEqual([
      {
        id: '6',
        groupId: '2',
        name: '',
        url: 'https://b.example.com',
        profileId: '6',
        onlyQueues: true,
      },
    ])
  })

  it('should keep the first URL of a profile listed twice', () => {
    expect(
      parseParameterizedUrls([
        { id: '1', url: 'https://a.example.com', profiles: '2', only_queues: false },
        { id: '2', url: 'https://b.example.com', profiles: '2', only_queues: false },
      ]).map((item) => item.url),
    ).toEqual(['https://a.example.com'])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseParameterizedUrls({})).toThrow()
  })
})

describe('profiles', () => {
  it('should name a profile, or show its id when it is unknown', () => {
    expect(getProfileName('3', PROFILES)).toBe('Advanced')
    expect(getProfileName('9', PROFILES)).toBe('#9')
  })

  it('should sort by name, then by URL and by profile name', () => {
    expect(sortParameterizedUrls(rows(), PROFILES).map((item) => item.profileId)).toEqual([
      '1',
      '2',
      '3',
    ])
    expect(
      sortParameterizedUrls(
        rows().map((item) => ({ ...item, name: '' })),
        PROFILES,
      ).map((item) => item.profileId),
    ).toEqual(['2', '1', '3'])
  })

  it('should offer only the profiles without a URL, plus the one being edited', () => {
    expect(getAvailableProfiles(PROFILES, rows()).map((profile) => profile.id)).toEqual(['5'])
    expect(getAvailableProfiles(PROFILES, rows(), row('3')).map((profile) => profile.id)).toEqual([
      '3',
      '5',
    ])
  })

  it('should tell when every profile has a URL', () => {
    expect(areAllProfilesBound(PROFILES, rows())).toBe(false)
    expect(areAllProfilesBound(PROFILES.slice(0, 3), rows())).toBe(true)
    expect(areAllProfilesBound([], [])).toBe(false)
  })

  it('should list the other profiles that use the same URL', () => {
    expect(getRowsSharingUrl(rows(), ` ${CRM} `).map((item) => item.profileId)).toEqual(['1', '2'])
    expect(getRowsSharingUrl(rows(), CRM, row('1')).map((item) => item.profileId)).toEqual(['2'])
    expect(getRowsSharingUrl(rows(), 'https://other.example.com')).toEqual([])
  })
})

describe('forms', () => {
  it('should fill the edit form from a row', () => {
    expect(toParameterizedUrlForm(row('3'))).toEqual({
      name: 'Helpdesk ticket',
      url: SUPPORT,
      profileId: '3',
      onlyQueues: true,
    })
  })

  it('should copy the name, keep URL and calls and empty the profile when duplicating', () => {
    expect(toDuplicatedParameterizedUrlForm(row('3'), (name) => `${name} (copy)`)).toEqual({
      name: 'Helpdesk ticket (copy)',
      url: SUPPORT,
      profileId: '',
      onlyQueues: true,
    })
  })
})

describe('validateParameterizedUrlForm', () => {
  it('should accept a valid URL with a free profile', () => {
    expect(validateParameterizedUrlForm(form(), rows())).toEqual({})
  })

  it('should accept the URL of another profile', () => {
    expect(validateParameterizedUrlForm(form({ url: CRM }), rows())).toEqual({})
  })

  it('should require name, URL and profile', () => {
    expect(
      validateParameterizedUrlForm(form({ name: ' ', url: ' ', profileId: '' }), rows()),
    ).toEqual({
      name: 'integrations.param_urls.name_required',
      url: 'integrations.url_required',
      profileId: 'integrations.param_urls.profile_required',
    })
  })

  it('should reject malformed and oversized URLs', () => {
    for (const url of ['crm.example.com', 'ftp://crm.example.com', 'https://crm.example.com/a b']) {
      expect(validateParameterizedUrlForm(form({ url }), rows())).toEqual({
        url: 'integrations.url_invalid',
      })
    }
    expect(
      validateParameterizedUrlForm(form({ url: `https://crm.example.com/${'a'.repeat(240)}` }), []),
    ).toEqual({ url: 'integrations.param_urls.url_too_long' })
  })

  it('should reject a name longer than 50 characters or with control characters', () => {
    expect(validateParameterizedUrlForm(form({ name: 'a'.repeat(50) }), rows())).toEqual({})
    expect(validateParameterizedUrlForm(form({ name: ` ${'a'.repeat(50)} ` }), rows())).toEqual({})
    expect(validateParameterizedUrlForm(form({ name: 'a'.repeat(51) }), rows())).toEqual({
      name: 'integrations.param_urls.name_too_long',
    })
    for (const name of ['ERP\tcall', 'ERP\u0000call', 'ERP\u007fcall']) {
      expect(validateParameterizedUrlForm(form({ name }), rows())).toEqual({
        name: 'integrations.param_urls.name_invalid',
      })
    }
  })

  it('should list the name first when it is in use, for the focus', () => {
    expect(
      Object.keys(validateParameterizedUrlForm(form({ name: 'CRM base', url: '' }), rows())),
    ).toEqual(['name', 'url'])
  })

  it('should reject the name of another row, ignoring case and spaces, except its own', () => {
    for (const name of ['CRM base', ' crm BASE ']) {
      expect(validateParameterizedUrlForm(form({ name }), rows())).toEqual({
        name: 'integrations.param_urls.name_in_use',
      })
    }
    expect(
      validateParameterizedUrlForm(form({ name: 'CRM base', profileId: '1' }), rows(), row('1')),
    ).toEqual({})
    expect(
      validateParameterizedUrlForm(
        form({ name: 'crm standard', profileId: '1' }),
        rows(),
        row('1'),
      ),
    ).toEqual({
      name: 'integrations.param_urls.name_in_use',
    })
  })

  it('should reject a profile that already has a URL, except the one being edited', () => {
    expect(validateParameterizedUrlForm(form({ profileId: '3' }), rows())).toEqual({
      profileId: 'integrations.param_urls.profile_already_used',
    })
    expect(validateParameterizedUrlForm(form({ profileId: '3' }), rows(), row('3'))).toEqual({})
  })
})

describe('buildParameterizedUrlSavePlan', () => {
  it('should create a new URL for one profile', () => {
    expect(
      buildParameterizedUrlSavePlan(
        form({ url: ' https://erp.example.com ', onlyQueues: true }),
        rows(),
      ),
    ).toEqual({
      save: {
        method: 'POST',
        body: {
          url: 'https://erp.example.com',
          profiles: [5],
          only_queues: true,
          names: { '5': 'ERP call' },
        },
      },
      release: null,
    })
  })

  it('should add a profile to a URL that other profiles use, keeping them', () => {
    expect(buildParameterizedUrlSavePlan(form({ url: CRM, onlyQueues: true }), rows())).toEqual({
      save: {
        method: 'PUT',
        id: '4',
        body: {
          id: '4',
          url: CRM,
          profiles: [1, 2, 5],
          only_queues: true,
          names: { '5': 'ERP call' },
        },
      },
      release: null,
    })
  })

  it('should keep the other profiles of the URL when editing one of them', () => {
    expect(
      buildParameterizedUrlSavePlan(
        form({ name: ' CRM main ', url: CRM, profileId: '1', onlyQueues: true }),
        rows(),
        row('1'),
      ),
    ).toEqual({
      save: {
        method: 'PUT',
        id: '4',
        body: {
          id: '4',
          url: CRM,
          profiles: [1, 2],
          only_queues: true,
          names: { '1': 'CRM main' },
        },
      },
      release: null,
    })
  })

  it('should move a profile to a new URL without touching the others', () => {
    expect(
      buildParameterizedUrlSavePlan(
        form({ url: 'https://crm.example.com/v2', profileId: '1' }),
        rows(),
        row('1'),
      ),
    ).toEqual({
      save: {
        method: 'PUT',
        id: '4',
        body: {
          id: '4',
          url: 'https://crm.example.com/v2',
          profiles: [1],
          only_queues: false,
          names: { '1': 'ERP call' },
        },
      },
      release: null,
    })
  })

  it('should replace the profile of the URL', () => {
    expect(
      buildParameterizedUrlSavePlan(form({ url: SUPPORT, profileId: '5' }), rows(), row('3')),
    ).toEqual({
      save: {
        method: 'PUT',
        id: '7',
        body: {
          id: '7',
          url: SUPPORT,
          profiles: [5],
          only_queues: false,
          names: { '5': 'ERP call' },
        },
      },
      release: null,
    })
  })

  it('should release the previous URL when both URL and profile change', () => {
    expect(
      buildParameterizedUrlSavePlan(
        form({ url: 'https://erp.example.com', profileId: '5' }),
        rows(),
        row('3'),
      ),
    ).toEqual({
      save: {
        method: 'PUT',
        id: '7',
        body: {
          id: '7',
          url: 'https://erp.example.com',
          profiles: [5],
          only_queues: false,
          names: { '5': 'ERP call' },
        },
      },
      release: { url: SUPPORT, profiles: [3] },
    })
  })

  it('should join the profiles of the new URL when the URL changes to a shared one', () => {
    expect(
      buildParameterizedUrlSavePlan(form({ url: CRM, profileId: '3' }), rows(), row('3')),
    ).toEqual({
      save: {
        method: 'PUT',
        id: '4',
        body: {
          id: '4',
          url: CRM,
          profiles: [1, 2, 3],
          only_queues: false,
          names: { '3': 'ERP call' },
        },
      },
      release: null,
    })
  })
})

describe('buildParameterizedUrlDeletePayload', () => {
  it('should remove the URL from its profile only', () => {
    expect(buildParameterizedUrlDeletePayload(row('2'))).toEqual({ url: CRM, profiles: [2] })
  })
})
