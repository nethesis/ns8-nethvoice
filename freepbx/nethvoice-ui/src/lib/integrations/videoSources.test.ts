//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  buildSnapshotDataUrl,
  buildVideoSourcePayload,
  getVideoSourcePermissionName,
  parseVideoSources,
  toVideoSourceForm,
  validateVideoSourceForm,
  type VideoSourceForm,
} from './videoSources'

const rawSources = [
  {
    descr: 'Warehouse gate',
    url: 'http://192.0.2.20/snapshot.jpg',
    user: '',
    secret: 'camera-secret',
    'frame-rate': 1000,
    exten: null,
    open: '',
    profiles: [],
  },
  {
    descr: 'Front door',
    url: 'http://192.0.2.10/image.jpg',
    exten: 300,
    open: '*9',
    profiles: ['1', 3],
  },
]

const form = (changes: Partial<VideoSourceForm> = {}): VideoSourceForm => ({
  name: 'Front door',
  url: 'http://192.0.2.10/image.jpg',
  extension: '300',
  openCode: '*9',
  profileIds: ['3', '1'],
  ...changes,
})

describe('parseVideoSources', () => {
  it('should normalize the sources, sort them and drop the credentials', () => {
    expect(parseVideoSources(rawSources)).toEqual([
      {
        name: 'Front door',
        url: 'http://192.0.2.10/image.jpg',
        extension: '300',
        openCode: '*9',
        profileIds: ['1', '3'],
      },
      {
        name: 'Warehouse gate',
        url: 'http://192.0.2.20/snapshot.jpg',
        extension: '',
        openCode: '',
        profileIds: [],
      },
    ])
  })

  it('should treat extension 0 as no extension', () => {
    expect(
      parseVideoSources([{ descr: 'Gate', url: 'http://192.0.2.1/', exten: 0 }])[0],
    ).toMatchObject({
      extension: '',
      openCode: '',
      profileIds: [],
    })
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseVideoSources([{ name: 'Gate' }])).toThrow()
  })
})

describe('getVideoSourcePermissionName', () => {
  it('should mirror the permission name built by the server', () => {
    expect(getVideoSourcePermissionName('Front door #1')).toBe('vs_front_door_1')
    expect(getVideoSourcePermissionName('Gate')).toBe('vs_gate')
  })
})

describe('validateVideoSourceForm', () => {
  const others = parseVideoSources(rawSources).filter((source) => source.name !== 'Front door')

  it('should accept a complete source', () => {
    expect(validateVideoSourceForm(form(), others)).toEqual({})
    expect(validateVideoSourceForm(form({ extension: '', openCode: '' }), others)).toEqual({})
  })

  it('should report every invalid field', () => {
    expect(
      validateVideoSourceForm(
        form({ name: ' ', url: 'rtsp://192.0.2.10', openCode: '9a', profileIds: [] }),
        others,
      ),
    ).toEqual({
      name: 'integrations.video.name_required',
      url: 'integrations.url_invalid',
      openCode: 'integrations.video.open_code_invalid',
      profileIds: 'integrations.profiles_required',
    })
  })

  it('should reject names the API cannot address', () => {
    expect(validateVideoSourceForm(form({ name: 'Gate / north' }), others).name).toBe(
      'integrations.video.name_invalid',
    )
    expect(validateVideoSourceForm(form({ name: '###' }), others).name).toBe(
      'integrations.video.name_invalid',
    )
    expect(validateVideoSourceForm(form({ name: 'x'.repeat(51) }), others).name).toBe(
      'integrations.video.name_too_long',
    )
  })

  it('should reject a name whose permission collides with another source', () => {
    expect(validateVideoSourceForm(form({ name: 'warehouse-gate' }), others)).toEqual({})
    expect(validateVideoSourceForm(form({ name: 'Warehouse Gate!' }), others)).toEqual({
      name: 'integrations.video.name_already_used',
    })
  })

  it('should limit the opening code to ten characters', () => {
    expect(validateVideoSourceForm(form({ openCode: '*12345678#' }), others)).toEqual({})
    expect(validateVideoSourceForm(form({ openCode: '*123456789#' }), others)).toEqual({
      openCode: 'integrations.video.open_code_invalid',
    })
  })
})

describe('buildVideoSourcePayload', () => {
  it('should build the body of a new source', () => {
    expect(buildVideoSourcePayload(form({ name: ' Front door ' }))).toEqual({
      descr: 'Front door',
      url: 'http://192.0.2.10/image.jpg',
      exten: '300',
      open: '*9',
      profiles: [1, 3],
    })
  })

  it('should send the current name when editing and null when no extension is set', () => {
    const existing = parseVideoSources(rawSources)[0]

    expect(buildVideoSourcePayload(form({ name: 'Main door', extension: '' }), existing)).toEqual({
      currentDescr: 'Front door',
      descr: 'Main door',
      url: 'http://192.0.2.10/image.jpg',
      exten: null,
      open: '*9',
      profiles: [1, 3],
    })
  })

  it('should fill the form from a source', () => {
    expect(toVideoSourceForm(parseVideoSources(rawSources)[0])).toEqual(
      form({ profileIds: ['1', '3'] }),
    )
  })
})

describe('buildSnapshotDataUrl', () => {
  it('should detect the image type and drop line breaks', () => {
    expect(buildSnapshotDataUrl('/9j/4AAQ\r\nSkZJ\r\n')).toBe('data:image/jpeg;base64,/9j/4AAQSkZJ')
    expect(buildSnapshotDataUrl('iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(buildSnapshotDataUrl('R0lGODlh')).toBe('data:image/gif;base64,R0lGODlh')
  })

  it('should return nothing for an empty frame', () => {
    expect(buildSnapshotDataUrl('\r\n')).toBe('')
  })

  it('should return nothing when the source does not return an image', () => {
    expect(buildSnapshotDataUrl(btoa('<html><body>login</body></html>'))).toBe('')
  })
})
