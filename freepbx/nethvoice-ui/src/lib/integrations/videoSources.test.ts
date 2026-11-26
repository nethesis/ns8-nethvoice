//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import {
  applyDeviceType,
  applyQuality,
  buildCheckPayload,
  buildStoredCheckPayload,
  buildVideoSourcePayload,
  checkStoredVideoSource,
  connectionSignature,
  createLimitedQueue,
  defaultProfileIds,
  describeExtension,
  detectDeviceType,
  detectQuality,
  emptyVideoSourceForm,
  FANVIL_STREAMS,
  formatVideoInfo,
  fromDoorPhonePrefill,
  gateIssueKey,
  gateLimit,
  getAddressIssue,
  getFailureKey,
  isDoorPasswordRequest,
  isGateCodeLocked,
  issueParams,
  isTlsRelevant,
  mapSaveError,
  newGateForm,
  parseDoorPhonePrefill,
  parseDoorPhones,
  parseGateway,
  parseReachability,
  parseVideoSourceCheck,
  parseVideoSources,
  profileOfExtension,
  reachabilityKey,
  replaceUrlHost,
  syncDoorGates,
  testVideoSource,
  toVideoSourceForm,
  validateConnection,
  validateGates,
  validateSourceFields,
  type GateForm,
  type VideoSourceForm,
} from './videoSources'

vi.mock('@/lib/api/client', () => ({ api: { POST: vi.fn() } }))

const RAW_SOURCES = [
  {
    descr: 'Warehouse',
    type: 'rtsp',
    url: 'rtsp://192.0.2.52:554/stream1',
    user: 'viewer',
    has_secret: true,
    'frame-rate': null,
    exten: '302',
    open: '#1',
    gates: [
      {
        id: 7,
        position: 0,
        name: 'Dock door',
        type: 'dtmf',
        code: '#1',
        url: null,
        method: null,
        username: null,
        has_password: false,
        tls_fingerprint: null,
      },
      {
        id: 8,
        position: 1,
        name: 'Barrier',
        type: 'url',
        code: null,
        url: 'https://192.0.2.60/open',
        method: 'POST',
        username: 'admin',
        has_password: true,
        tls_fingerprint: 'AB:CD',
      },
    ],
    tls_skip_verify: true,
    tls_fingerprint: 'AA:BB',
    tls_unpinned: false,
    permission: 'vs_warehouse',
    gateway_path: 'streaming-gw/vs_warehouse',
    door_phone: null,
    profiles: ['1', 3],
  },
  {
    descr: 'Front door',
    type: 'image',
    url: 'http://192.0.2.10/snapshot.jpg',
    user: '',
    has_secret: false,
    'frame-rate': '1000',
    exten: null,
    open: '',
    gates: [],
    tls_skip_verify: false,
    tls_fingerprint: null,
    tls_unpinned: true,
    permission: 'vs_front_door',
    gateway_path: null,
    door_phone: '0C-38-3E-32-6B-84',
    profiles: [],
  },
]

const form = (overrides: Partial<VideoSourceForm> = {}): VideoSourceForm => ({
  ...emptyVideoSourceForm(['1']),
  name: 'Parking',
  url: 'rtsp://192.0.2.30:554/stream1',
  ...overrides,
})

const gate = (overrides: Partial<GateForm> = {}): GateForm => ({
  ...newGateForm('Main gate'),
  code: '*1',
  ...overrides,
})

describe('parseVideoSources', () => {
  it('maps the API sources and sorts them by name', () => {
    const [front, warehouse] = parseVideoSources(RAW_SOURCES)

    expect(front).toEqual({
      name: 'Front door',
      type: 'image',
      url: 'http://192.0.2.10/snapshot.jpg',
      user: '',
      hasSecret: false,
      extension: '',
      gates: [],
      tlsSkipVerify: false,
      tlsUnpinned: true,
      doorPhone: '0C-38-3E-32-6B-84',
      profileIds: [],
    })
    expect(warehouse?.extension).toBe('302')
    expect(warehouse?.profileIds).toEqual(['1', '3'])
    expect(warehouse?.gates).toEqual([
      {
        id: 7,
        name: 'Dock door',
        type: 'dtmf',
        code: '#1',
        url: '',
        method: 'GET',
        username: '',
        hasPassword: false,
      },
      {
        id: 8,
        name: 'Barrier',
        type: 'url',
        code: '',
        url: 'https://192.0.2.60/open',
        method: 'POST',
        username: 'admin',
        hasPassword: true,
      },
    ])
  })
})

describe('payload mapping', () => {
  it('builds the create payload of a manual source with gates', () => {
    const payload = buildVideoSourcePayload(
      form({
        name: ' Parking ',
        extension: '301',
        user: 'admin',
        password: 'Secret-1',
        profileIds: ['1', '3'],
        gates: [
          gate({ name: 'Barrier', code: '*9' }),
          gate({
            name: 'Door',
            type: 'url',
            code: '*1',
            url: 'http://192.0.2.60/open',
            method: 'POST',
            username: 'admin',
            password: 'Gate-1',
          }),
          gate({ name: 'Side', type: 'url', url: 'http://192.0.2.61/', password: 'dropped' }),
        ],
      }),
    )

    expect(payload).toEqual({
      descr: 'Parking',
      url: 'rtsp://192.0.2.30:554/stream1',
      user: 'admin',
      secret: 'Secret-1',
      exten: '301',
      tls_skip_verify: false,
      profiles: [1, 3],
      gates: [
        { name: 'Barrier', type: 'dtmf', code: '*9' },
        {
          name: 'Door',
          type: 'url',
          url: 'http://192.0.2.60/open',
          method: 'POST',
          username: 'admin',
          password: 'Gate-1',
        },
        {
          name: 'Side',
          type: 'url',
          url: 'http://192.0.2.61/',
          method: 'GET',
          username: '',
          password: '',
        },
      ],
    })
  })

  it('round-trips a stored source through the form, keeping gate ids and passwords empty', () => {
    const [, warehouse] = parseVideoSources(RAW_SOURCES)
    const sourceForm = toVideoSourceForm(warehouse!)

    expect(sourceForm.password).toBe('')
    expect(sourceForm.deviceType).toBe('other')
    expect(buildVideoSourcePayload(sourceForm, warehouse)).toEqual({
      currentDescr: 'Warehouse',
      descr: 'Warehouse',
      url: 'rtsp://192.0.2.52:554/stream1',
      user: 'viewer',
      secret: '',
      exten: '302',
      tls_skip_verify: true,
      profiles: [1, 3],
      gates: [
        { id: 7, name: 'Dock door', type: 'dtmf', code: '#1' },
        {
          id: 8,
          name: 'Barrier',
          type: 'url',
          url: 'https://192.0.2.60/open',
          method: 'POST',
          username: 'admin',
          password: '',
        },
      ],
    })
  })

  it('sends tls_skip_verify only when the source or a gate uses TLS', () => {
    expect(buildVideoSourcePayload(form({ tlsSkipVerify: true })).tls_skip_verify).toBe(false)
    expect(
      buildVideoSourcePayload(form({ url: 'rtsps://192.0.2.30/live', tlsSkipVerify: true }))
        .tls_skip_verify,
    ).toBe(true)
    expect(
      isTlsRelevant(form({ gates: [gate({ type: 'url', url: 'https://192.0.2.60/' })] })),
    ).toBe(true)
  })

  it('drops the password without a username and references the door phone', () => {
    expect(buildVideoSourcePayload(form({ password: 'orphan' })).secret).toBe('')
    expect(buildVideoSourcePayload(form()).exten).toBeNull()

    const doorForm = form({
      user: 'rtsp-user',
      password: 'typed',
      doorPhone: '0C-38-3E-32-6B-84',
    })
    const payload = buildVideoSourcePayload(doorForm)
    expect(payload.secret).toBe('')
    expect(payload.user).toBe('rtsp-user')
    expect(payload.door_phone).toBe('0C-38-3E-32-6B-84')
    expect(buildCheckPayload(doorForm)).toMatchObject({
      secret: '',
      door_phone: '0C-38-3E-32-6B-84',
    })

    const typed = buildVideoSourcePayload({ ...doorForm, ownCredentials: true })
    expect(typed.secret).toBe('typed')
    expect(typed).not.toHaveProperty('door_phone')
    expect(buildCheckPayload({ ...doorForm, ownCredentials: true })).not.toHaveProperty(
      'door_phone',
    )
  })

  it('never puts a stored secret in the form or in the payloads', () => {
    const [, warehouse] = parseVideoSources(RAW_SOURCES)
    const sourceForm = toVideoSourceForm(warehouse!)

    expect(warehouse?.hasSecret).toBe(true)
    expect(sourceForm.password).toBe('')
    expect(sourceForm.gates[1]).toMatchObject({ hasPassword: true, password: '' })
    expect(JSON.stringify(parseVideoSources(RAW_SOURCES))).not.toContain('secret"')
    expect(buildVideoSourcePayload(sourceForm, warehouse).secret).toBe('')
    expect(buildCheckPayload(sourceForm, warehouse).secret).toBe('')
  })

  it('builds the check payloads', () => {
    const [front, warehouse] = parseVideoSources(RAW_SOURCES)

    expect(buildCheckPayload(form({ user: 'admin', password: 'pw' }))).toEqual({
      url: 'rtsp://192.0.2.30:554/stream1',
      user: 'admin',
      secret: 'pw',
      tls_skip_verify: false,
      details: true,
    })
    expect(buildCheckPayload(toVideoSourceForm(warehouse!), warehouse)).toMatchObject({
      descr: 'Warehouse',
      secret: '',
    })
    expect(buildStoredCheckPayload(front!)).toEqual({
      url: 'http://192.0.2.10/snapshot.jpg',
      user: '',
      secret: '',
      tls_skip_verify: false,
      details: true,
      descr: 'Front door',
      door_phone: '0C-38-3E-32-6B-84',
    })
  })

  it('changes the connection signature only with the connection settings', () => {
    const base = form({ user: 'admin', password: 'pw' })

    expect(connectionSignature({ ...base, name: 'Other' })).toBe(connectionSignature(base))
    expect(connectionSignature({ ...base, password: 'pw2' })).not.toBe(connectionSignature(base))
    expect(connectionSignature({ ...base, tlsSkipVerify: true })).toBe(connectionSignature(base))
  })
})

describe('validation', () => {
  it('checks the name rules of the backend', () => {
    const others = [{ name: 'Main entrance' }]

    expect(validateSourceFields(form({ name: '  ' }), others).name).toBe(
      'integrations.video.name_required',
    )
    expect(validateSourceFields(form({ name: 'x'.repeat(51) }), others).name).toBe(
      'integrations.video.name_too_long',
    )
    expect(validateSourceFields(form({ name: 'à'.repeat(26) }), others).name).toBe(
      'integrations.video.name_too_long',
    )
    expect(validateSourceFields(form({ name: '!!!' }), others).name).toBe(
      'integrations.video.name_invalid',
    )
    expect(validateSourceFields(form({ name: 'a/b' }), others).name).toBe(
      'integrations.video.name_invalid',
    )
    expect(validateSourceFields(form({ name: 'main entrance!' }), others).name).toBe(
      'integrations.video.name_already_used',
    )
  })

  it('checks URL, profiles, extension and credentials', () => {
    expect(validateSourceFields(form({ url: '' }), []).url).toBe('integrations.video.url_required')
    expect(validateSourceFields(form({ url: 'ftp://192.0.2.1/' }), []).url).toBe(
      'integrations.video.url_invalid',
    )
    expect(validateSourceFields(form({ url: 'rtsp:// 192.0.2.1' }), []).url).toBe(
      'integrations.video.url_invalid',
    )
    expect(validateSourceFields(form({ url: `http://h/${'a'.repeat(8000)}` }), []).url).toBe(
      'integrations.video.url_too_long',
    )
    expect(validateSourceFields(form({ url: 'RTSPS://cam.example.org/live' }), [])).toEqual({})
    expect(validateSourceFields(form({ profileIds: [] }), []).profileIds).toBe(
      'integrations.profiles_required',
    )
    expect(validateSourceFields(form({ extension: '30a' }), []).extension).toBe(
      'integrations.video.extension_invalid',
    )
    expect(validateSourceFields(form({ user: 'u'.repeat(256) }), []).user).toBe(
      'integrations.video.credential_too_long',
    )
  })

  it('checks the gates', () => {
    const named = gate({ name: '' })
    const badCode = gate({ code: '*1x' })
    const longCode = gate({ code: '1'.repeat(31) })
    const backendSet = gate({ code: 'aD+#*9' })
    const noUrl = gate({ type: 'url', url: '' })
    const badUrl = gate({ type: 'url', url: 'rtsp://192.0.2.1/' })
    const issues = validateGates(
      form({ extension: '300', gates: [named, badCode, longCode, backendSet, noUrl, badUrl] }),
      10,
    )

    expect(issues).toEqual({
      [gateIssueKey(named.uid, 'name')]: 'integrations.video.gate_name_required',
      [gateIssueKey(badCode.uid, 'code')]: 'integrations.video.dtmf_invalid',
      [gateIssueKey(longCode.uid, 'code')]: 'integrations.video.dtmf_too_long',
      [gateIssueKey(noUrl.uid, 'url')]: 'integrations.video.gate_url_required',
      [gateIssueKey(badUrl.uid, 'url')]: 'integrations.video.gate_url_invalid',
    })
  })

  it('accepts only the codes a door phone takes on the gates of a linked source', () => {
    const linked = form({ extension: '305', doorPhone: '0C-38-3E-32-7C-01' })
    const plus = gate({ code: '+1' })
    const long = gate({ code: '1'.repeat(17) })
    const valid = gate({ code: 'A*#9' })

    expect(validateGates({ ...linked, gates: [plus, long, valid] }, 10)).toEqual({
      [gateIssueKey(plus.uid, 'code')]: 'integrations.video.door_dtmf_invalid',
      [gateIssueKey(long.uid, 'code')]: 'integrations.video.door_dtmf_invalid',
    })
    expect(validateGates({ ...linked, ownCredentials: true, gates: [plus] }, 10)).toEqual({})
    expect(issueParams('integrations.video.door_dtmf_invalid')).toEqual({ max: 16 })
    expect(issueParams('integrations.video.credential_too_long')).toEqual({ max: 255 })
    expect(issueParams('integrations.video.url_required')).toEqual({})
  })

  it('asks for the password of a door phone source only when the PBX refused its own', () => {
    const doorForm = form({ user: 'rtsp', doorPhone: '0C-38-3E-32-7C-01' })

    expect(validateConnection({ ...doorForm, password: 'x'.repeat(300) })).toEqual({})
    expect(validateConnection({ ...doorForm, ownCredentials: true })).toEqual({
      password: 'integrations.video.door_phone_password_required',
    })
    expect(validateConnection({ ...doorForm, ownCredentials: true, password: 'pw' })).toEqual({})
  })

  it('requires an extension only for DTMF gates and enforces the gate limit', () => {
    const dtmf = gate()

    expect(validateGates(form({ gates: [dtmf] }), 10)).toEqual({
      [gateIssueKey(dtmf.uid, 'code')]: 'integrations.video.dtmf_needs_extension',
      extension: 'integrations.video.dtmf_needs_extension',
    })
    expect(
      validateGates(form({ gates: [gate({ type: 'url', url: 'http://192.0.2.1/' })] }), 10),
    ).toEqual({})
    expect(validateGates(form({ extension: '300', gates: [gate(), gate()] }), 1).gates).toBe(
      'integrations.video.too_many_gates',
    )
    expect(gateLimit('', 2)).toBe(10)
    expect(gateLimit('0C-38-3E-32-6B-84', 2)).toBe(2)
    expect(gateLimit('0C-38-3E-32-6B-84', null)).toBe(10)
  })
})

describe('connection check', () => {
  it('parses a successful RTSP check', () => {
    const check = parseVideoSourceCheck({
      success: true,
      type: 'rtsp',
      image: '/9j/4AAQ\nSkZJRg==',
      mime: 'image/jpeg',
      video: { codec: 'h264', width: 1280, height: 720 },
      audio: { codec: 'pcm_mulaw', sample_rate: 8000 },
      h265: false,
      warnings: ['tls_certificate_changed', 'something_new'],
      reason: null,
      message: '',
      tls_fingerprint: null,
    })

    expect(check).toEqual({
      success: true,
      type: 'rtsp',
      imageUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      mime: 'image/jpeg',
      video: { codec: 'h264', width: 1280, height: 720 },
      warnings: ['tls_certificate_changed'],
      reason: null,
      message: '',
    })
    expect(formatVideoInfo(check)).toBe('H264, 1280 × 720')
  })

  it.each([
    ['timeout', 'integrations.video.failure_timeout'],
    ['auth_failed', 'integrations.video.failure_auth_failed'],
    ['connection_refused', 'integrations.video.failure_connection_refused'],
    ['not_found', 'integrations.video.failure_not_found'],
    ['tls_error', 'integrations.video.failure_tls_error'],
    ['unsupported', 'integrations.video.failure_unsupported'],
    ['address_not_allowed', 'integrations.video.failure_address_not_allowed'],
    ['unknown', 'integrations.video.failure_unknown'],
    ['brand_new_reason', 'integrations.video.failure_unknown'],
    [null, 'integrations.video.failure_unknown'],
  ])('maps the failure reason %s', (reason, key) => {
    const check = parseVideoSourceCheck({
      success: false,
      type: 'rtsp',
      image: null,
      mime: null,
      video: null,
      audio: null,
      h265: false,
      warnings: [],
      reason,
      message: 'rtsp://192.0.2.52:554/stream1: Connection timed out',
    })

    expect(check.success).toBe(false)
    expect(check.imageUrl).toBe('')
    expect(check.message).toBe('rtsp://192.0.2.52:554/stream1: Connection timed out')
    expect(getFailureKey(check)).toBe(key)
  })

  it('tells a PBX node address from a loopback address', () => {
    const check = (message: string) =>
      parseVideoSourceCheck({ success: false, reason: 'address_not_allowed', message })

    expect(getFailureKey(check('the addresses of the PBX node are refused'))).toBe(
      'integrations.video.address_of_pbx',
    )
    expect(getFailureKey(check('loopback and link-local addresses are refused'))).toBe(
      'integrations.video.address_loopback',
    )
    expect(getAddressIssue('something else')).toBe('integrations.video.failure_address_not_allowed')
  })

  it('describes image sources by MIME type and natural size', () => {
    const check = parseVideoSourceCheck({
      success: true,
      type: 'image',
      image: 'iVBORw0KGgo=',
      mime: 'image/png',
      video: null,
    })

    expect(formatVideoInfo(check)).toBe('PNG')
    expect(formatVideoInfo(check, { width: 640, height: 480 })).toBe('PNG, 640 × 480')
    expect(formatVideoInfo({ ...check, mime: 'image/gif' })).toBe('')
  })

  it('leaves the request errors of the form check to the form', async () => {
    const error = new ApiError({
      status: 400,
      method: 'POST',
      url: '/cti/sources/test',
      body: { status: 'invalid door phone', field: 'door_phone' },
    })
    vi.mocked(api.POST).mockRejectedValueOnce(error)

    await expect(testVideoSource(buildCheckPayload(form()))).rejects.toBe(error)
  })

  it('turns the request errors of a stored source check into a failed check and keeps aborts', async () => {
    const [front] = parseVideoSources(RAW_SOURCES)

    vi.mocked(api.POST).mockRejectedValueOnce(
      new ApiError({
        status: 400,
        method: 'POST',
        url: '/cti/sources/test',
        body: { status: 'Invalid source URL' },
      }),
    )
    await expect(checkStoredVideoSource(front!)).resolves.toMatchObject({
      success: false,
      reason: 'unknown',
      message: 'Invalid source URL',
    })

    vi.mocked(api.POST).mockRejectedValueOnce(
      new ApiError({ status: 500, method: 'POST', url: '/cti/sources/test', body: null }),
    )
    await expect(checkStoredVideoSource(front!)).resolves.toMatchObject({
      success: false,
      message: '',
    })

    const controller = new AbortController()
    controller.abort()
    vi.mocked(api.POST).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    await expect(checkStoredVideoSource(front!, controller.signal)).rejects.toThrow('aborted')
  })

  it('posts the check with details', async () => {
    vi.mocked(api.POST).mockResolvedValueOnce({
      data: { success: true, type: 'image', image: 'iVBORw0KGgo=', mime: 'image/png' },
      response: new Response(),
    })

    await testVideoSource(buildCheckPayload(form({ url: 'http://192.0.2.10/snap.png' })))

    expect(api.POST).toHaveBeenLastCalledWith('/cti/sources/test', {
      body: {
        url: 'http://192.0.2.10/snap.png',
        user: '',
        secret: '',
        tls_skip_verify: false,
        details: true,
      },
      signal: undefined,
    })
  })
})

describe('createLimitedQueue', () => {
  it('runs at most the given number of tasks at once, all of them in order', async () => {
    const queue = createLimitedQueue(3)
    const resolvers: (() => void)[] = []
    const started: number[] = []
    let running = 0
    let peak = 0

    const results = Array.from({ length: 7 }, (_item, index) =>
      queue.run(
        () =>
          new Promise<number>((resolve) => {
            started.push(index)
            running += 1
            peak = Math.max(peak, running)
            resolvers.push(() => {
              running -= 1
              resolve(index)
            })
          }),
      ),
    )

    expect(started).toEqual([0, 1, 2])
    expect(queue.size).toBe(7)

    while (resolvers.length > 0) {
      resolvers.shift()?.()
      await Promise.resolve()
      await Promise.resolve()
    }
    await expect(Promise.all(results)).resolves.toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(started).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(peak).toBe(3)
    expect(queue.size).toBe(0)
  })

  it('goes on after a failed task', async () => {
    const queue = createLimitedQueue(1)
    const failing = queue.run(() => Promise.reject(new Error('down')))
    const next = queue.run(() => Promise.resolve('ok'))

    await expect(failing).rejects.toThrow('down')
    await expect(next).resolves.toBe('ok')
  })
})

describe('devices and door phones', () => {
  it('detects and applies the Fanvil preset and the stream quality', () => {
    expect(detectDeviceType('rtsp://192.0.2.50:554/h264/stream.live1')).toBe('fanvil')
    expect(detectDeviceType('rtsp://192.0.2.50:8554/h264/stream.live1')).toBe('other')
    expect(applyDeviceType('http://admin@192.0.2.50/snap.jpg', 'fanvil')).toBe(
      'rtsp://192.0.2.50:554/h264/stream.live0',
    )
    expect(applyDeviceType('', 'fanvil')).toBe('')
    expect(detectQuality('rtsp://192.0.2.50:554/h264/stream.live1', FANVIL_STREAMS)).toBe('sub')
    expect(applyQuality('rtsp://192.0.2.50:554/h264/stream.live0?x=1', FANVIL_STREAMS, 'sub')).toBe(
      'rtsp://192.0.2.50:554/h264/stream.live1?x=1',
    )
  })

  it('keys the reachability by host and port', () => {
    expect(reachabilityKey('rtsp://user:pw@Cam.example.org/live')).toBe('cam.example.org:554')
    expect(reachabilityKey('rtsps://192.0.2.1/live')).toBe('192.0.2.1:322')
    expect(reachabilityKey('http://192.0.2.1:8080/snap.jpg')).toBe('192.0.2.1:8080')
    expect(reachabilityKey('rtsp://[2001:db8::1]:8554/live')).toBe('[2001:db8::1]:8554')
    expect(reachabilityKey('ftp://192.0.2.1/')).toBe('')
  })

  it('parses the reachability and suggests the public address of a door phone', () => {
    expect(
      parseReachability({
        host: '192.168.5.218',
        port: 554,
        private: true,
        reachable: false,
        public_address: '203.0.113.7',
        public_url: 'rtsp://203.0.113.7:554/h264/stream.live0',
      }),
    ).toEqual({
      host: '192.168.5.218',
      port: 554,
      private: true,
      reachable: false,
      publicAddress: '203.0.113.7',
    })
    expect(
      parseReachability({ host: 'cam', port: 80, private: false, reachable: true }).publicAddress,
    ).toBe('')
    expect(replaceUrlHost('rtsp://192.168.5.218:554/h264/stream.live0', '203.0.113.7')).toBe(
      'rtsp://203.0.113.7:554/h264/stream.live0',
    )
    expect(replaceUrlHost('rtsp://u:p@cam.lan/live', '2001:db8::7')).toBe(
      'rtsp://u:p@[2001:db8::7]/live',
    )
    expect(parseGateway({ public_ip: null, ice_hosts: [] })).toEqual({ publicIp: '' })
    expect(parseGateway({ public_ip: '203.0.113.1' })).toEqual({ publicIp: '203.0.113.1' })
  })

  it('parses door phones and the prefill, and locks relay codes', () => {
    const [phone] = parseDoorPhones([
      {
        mac: '0C-38-3E-32-7C-01',
        model: 'fanvil-i62',
        model_name: 'Fanvil i62',
        extension: '305',
        name: 'Courtyard',
        ip: null,
        registered: false,
        url: '',
        user: 'rtsp',
        has_secret: false,
        dtmf_code: '*',
        dtmf_code_2: null,
        max_gates: 2,
        door_gates: [
          { relay: 2, code: null, url: 'http://192.0.2.218/relay?output=2', user: 'admin' },
          { relay: 1, code: '*', url: 'http://192.0.2.218/relay?output=1', user: 'admin' },
        ],
        streams: { main: '/h264/stream.live0', sub: null, main_label: '', sub_label: '' },
        sources: [],
      },
    ])
    expect(phone).toMatchObject({ ip: '', registered: false, maxGates: 2 })
    expect(phone?.relays.map((relay) => relay.relay)).toEqual([1, 2])

    const prefill = parseDoorPhonePrefill({
      descr: 'Courtyard',
      exten: '305',
      url: 'rtsp://192.0.2.218:554/h264/stream.live0',
      user: 'rtsp',
      has_secret: true,
      door_phone: '0C-38-3E-32-7C-01',
      streams: {
        main: '/h264/stream.live0',
        sub: '/h264/stream.live1',
        main_label: '1280x720',
        sub_label: '640x480',
      },
      gates: [{ name: 'Door 1', type: 'dtmf', code: '*' }],
      door_gates: phone?.relays.map((relay) => ({ ...relay, code: relay.code || null })),
      max_gates: 2,
      ip: '192.0.2.218',
      registered: true,
      credentials_generated: true,
    })
    const sourceForm = fromDoorPhonePrefill(prefill, ['5'])

    expect(sourceForm).toMatchObject({
      name: 'Courtyard',
      extension: '305',
      deviceType: 'fanvil',
      quality: 'main',
      doorPhone: '0C-38-3E-32-7C-01',
      profileIds: ['5'],
    })
    expect(prefill.streams).toMatchObject({ mainLabel: '1280 × 720', subLabel: '640 × 480' })
    expect(sourceForm.gates.map(({ name, code }) => ({ name, code }))).toEqual([
      { name: 'Door 1', code: '*' },
    ])
    expect(isGateCodeLocked(sourceForm.gates[0]!, 0, prefill.relays)).toBe(true)

    const synced = syncDoorGates(
      [sourceForm.gates[0]!, gate({ type: 'url', url: '', username: '' })],
      prefill.relays,
    )
    expect(synced[1]).toMatchObject({
      url: 'http://192.0.2.218/relay?output=2',
      username: 'admin',
      method: 'GET',
    })
    const moved = syncDoorGates([gate({ code: '9' }), synced[0]!], prefill.relays)
    expect(moved[0]?.code).toBe('*')
    expect(isGateCodeLocked(moved[1]!, 1, prefill.relays)).toBe(false)
  })

  it('chooses the default profiles', () => {
    const profiles = [
      { id: '1', name: 'Base' },
      { id: '5', name: 'Security staff' },
    ]
    const users = [
      { mainExtension: '200', profileId: 5, devices: [{ extension: '305' }] },
      { mainExtension: '201', profileId: null, devices: [] },
    ]

    expect(defaultProfileIds(profiles)).toEqual(['1'])
    expect(defaultProfileIds(profiles, profileOfExtension(users, '305'))).toEqual(['5'])
    expect(defaultProfileIds(profiles, profileOfExtension(users, '201'))).toEqual(['1'])
    expect(defaultProfileIds([{ id: '2', name: 'Custom' }])).toEqual([])
  })

  it('labels extensions as name and number', () => {
    const options = [{ extension: '302', name: 'Warehouse' }]

    expect(describeExtension('302', options)).toBe('Warehouse (302)')
    expect(describeExtension('309', options)).toBe('309')
    expect(describeExtension('', options)).toBe('-')
  })
})

describe('mapSaveError', () => {
  const gates = [gate(), gate()]
  const apiError = (status: number, body: unknown) =>
    new ApiError({ status, method: 'POST', url: '/cti/streaming', body })

  it('maps a conflict to the name', () => {
    expect(mapSaveError(apiError(409, { status: 'video source x already exists' }), gates)).toEqual(
      { issues: { name: 'integrations.video.name_already_used' }, message: '' },
    )
  })

  it('maps field errors, including gate fields, to the form', () => {
    expect(
      mapSaveError(
        apiError(400, {
          status: 'the device address changed: type the password again',
          field: 'secret',
        }),
        gates,
      ),
    ).toEqual({
      issues: { password: 'integrations.video.password_address_changed' },
      message: '',
    })
    expect(
      mapSaveError(apiError(400, { status: 'invalid DTMF code', field: 'gates[1].code' }), gates),
    ).toEqual({
      issues: { [gateIssueKey(gates[1]!.uid, 'code')]: 'integrations.video.dtmf_invalid' },
      message: '',
    })
    expect(
      mapSaveError(apiError(400, { status: 'frame rate is odd', field: 'frame-rate' }), gates),
    ).toEqual({ issues: {}, message: 'Frame rate is odd' })
  })

  it('maps the address checks of limited administrators and of door phones', () => {
    expect(
      mapSaveError(
        apiError(400, {
          status: 'the device address is not allowed: the addresses of the PBX node are refused',
          field: 'url',
        }),
        gates,
      ),
    ).toEqual({ issues: { url: 'integrations.video.address_of_pbx' }, message: '' })
    expect(
      mapSaveError(
        apiError(400, {
          status: 'the device address is not allowed: the addresses of the PBX node are refused',
          field: 'gates[0].url',
        }),
        gates,
      ),
    ).toEqual({
      issues: { [gateIssueKey(gates[0]!.uid, 'url')]: 'integrations.video.address_of_pbx' },
      message: '',
    })
    expect(
      mapSaveError(
        apiError(400, {
          status:
            'the device address is not allowed: loopback and link-local addresses are refused',
          field: 'url',
        }),
        gates,
      ).issues,
    ).toEqual({ url: 'integrations.video.address_loopback' })

    const doorPassword = mapSaveError(
      apiError(400, {
        status:
          'the door phone password is sent only to the address the door phone registers from: type the password',
        field: 'secret',
      }),
      gates,
    )
    expect(doorPassword.issues).toEqual({
      password: 'integrations.video.door_phone_password_not_allowed',
    })
    expect(isDoorPasswordRequest(doorPassword.issues)).toBe(true)
    expect(
      mapSaveError(
        apiError(400, {
          status: 'invalid door phone DTMF code: use 1 to 16 characters among 0-9, A-D, * and #',
          field: 'gates[1].code',
        }),
        gates,
      ).issues,
    ).toEqual({ [gateIssueKey(gates[1]!.uid, 'code')]: 'integrations.video.door_dtmf_invalid' })
    expect(
      mapSaveError(apiError(400, { status: 'door phone not found', field: 'door_phone' }), gates),
    ).toEqual({ issues: {}, message: 'integrations.video.door_phone_not_found' })
  })

  it('leaves server errors to the generic text', () => {
    expect(mapSaveError(apiError(500, null), gates)).toEqual({ issues: {}, message: '' })
    expect(mapSaveError(apiError(404, { status: 'video source x not found' }), gates)).toEqual({
      issues: {},
      message: '',
    })
    expect(mapSaveError(new TypeError('Failed to fetch'), gates)).toEqual({
      issues: {},
      message: '',
    })
  })
})
