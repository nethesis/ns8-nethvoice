//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { MockApi, MockRequest, MockResponse } from '../fixtures/mockApi'

export const FRAME =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAkAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDn/Jo8mr3k+1Hk+1evzHl8pR8mjyaveT7VNbps3e+KmVTlVyoU+Z2MvyaPJrWnXcgHvVfyfalCpzK450+V2KPk0eTV7yfajyfar5iOUveTWPf3dxBeyRJJhVxgbR6Cum8n2rm9Wsrl9TlaO2ldTtwyoSDwK45ydtDrpxV9Sr/aN3/z1/8AHR/hV/S7iW483zX3bcY4A9azvsF7/wA+k/8A37NaWkWtzH53mW8qZ243IRnrWTcmbJRQ/UppILdWjbaS4GcZ7Gsz+0bv/nr/AOOj/CtTVbaeS1UJBIx3g4VCexrJ+wXv/PpP/wB+zQnJbA1F7k1vfXMlzEjSZDOARtHr9K3PJrDs7G7W9gLWswUSKSTGcAZrqvJ9q1hJ9TKpFX0Lm0UbRRRUjDaKNooooANoo2iiigA2ijaKKKAP/9k='

export const PROFILES = [
  { id: 1, name: 'Base', macro_permissions: {} },
  { id: 3, name: 'Standard', macro_permissions: {} },
  { id: 4, name: 'Advanced', macro_permissions: {} },
  { id: 6, name: 'Reception', macro_permissions: {} },
  { id: 7, name: 'Security staff', macro_permissions: {} },
]

export const EXTENSIONS = [
  { extension: '300', name: 'Main entrance', password: '' },
  { extension: '301', name: 'Parking', password: '' },
  { extension: '302', name: 'Warehouse', password: '' },
  { extension: '303', name: 'Reception', password: '' },
  { extension: '304', name: 'Office', password: '' },
  { extension: '305', name: 'Courtyard', password: '' },
  { extension: '306', name: 'Training room', password: '' },
]

export const USERS = [
  {
    id: '11',
    username: 'courtyard',
    displayname: 'Courtyard',
    default_extension: '205',
    email: '',
    profile: 7,
    devices: [
      {
        id: 31,
        user_id: 11,
        mac: '0C-38-3E-32-7C-01',
        vendor: 'Fanvil',
        model: 'fanvil-i62',
        line: 1,
        extension: '305',
        type: 'physical',
        registered: true,
      },
    ],
  },
  {
    id: '12',
    username: 'training',
    displayname: 'Training room',
    default_extension: '306',
    email: '',
    profile: 3,
    devices: [],
  },
]

export const PUBLIC_IP = '203.0.113.25'

type Gate = {
  id: number
  name: string
  type: 'dtmf' | 'url'
  code: string | null
  url: string | null
  method: 'GET' | 'POST' | null
  username: string | null
  password: string
}

type StoredSource = {
  descr: string
  url: string
  user: string
  secret: string
  exten: string | null
  frameRate: string | null
  gates: Gate[]
  tlsSkipVerify: boolean
  tlsUnpinned: boolean
  doorPhone: string | null
  profiles: string[]
}

export type CheckResult = {
  success: boolean
  reason?: string
  message?: string
  video?: { codec: string; width: number; height: number } | null
  warnings?: string[]
  image?: string | null
  mime?: string | null
  secret?: string
}

export type DoorPhoneSeed = {
  mac: string
  model: string
  model_name: string
  extension: string
  name: string
  ip: string | null
  dtmfCode: string | null
  dtmfCode2: string | null
  maxGates: number | null
  credentialsGenerated?: boolean
}

const MAX_GATES = 10
const DTMF = /^[0-9A-Da-d*#+]{1,30}$/
const DOOR_DTMF = /^[0-9A-Da-d*#]{1,16}$/
const NODE_REFUSED = 'the addresses of the PBX node are refused'
const DOOR_SECRET_REFUSED =
  'the door phone password is sent only to the address the door phone registers from: type the password'
const MAC = /^[0-9A-F]{2}(-[0-9A-F]{2}){5}$/
const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443, rtsp: 554, rtsps: 322 }
const RTSP_USER = 'rtsp-viewer'

export type HoldKind = 'list' | 'save' | 'test' | 'reachability'

class Invalid extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
  }
}

const permissionOf = (descr: string) =>
  `vs_${descr
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/ /g, '_')
    .toLowerCase()}`

type ParsedUrl = { scheme: string; host: string; port: number; user: string; secret: string }

const parseUrl = (url: string): ParsedUrl | null => {
  const match = /^([a-z]+):\/\/([^/?#]*)(.*)$/i.exec(url)

  if (!match || /[\s\x00-\x1f]/.test(url)) {
    return null
  }
  const scheme = (match[1] ?? '').toLowerCase()
  let authority = match[2] ?? ''
  let user = ''
  let secret = ''
  const at = authority.lastIndexOf('@')

  if (at >= 0) {
    const credentials = authority.slice(0, at)
    const colon = credentials.indexOf(':')
    user = decodeURIComponent(colon < 0 ? credentials : credentials.slice(0, colon))
    secret = colon < 0 ? '' : decodeURIComponent(credentials.slice(colon + 1))
    authority = authority.slice(at + 1)
  }
  const hostMatch = /^(\[[0-9a-fA-F:.]+\]|[a-zA-Z0-9._-]+)(?::(\d{1,5}))?$/.exec(authority)

  if (!hostMatch || DEFAULT_PORTS[scheme] === undefined) {
    return null
  }
  const port = hostMatch[2] ? Number(hostMatch[2]) : DEFAULT_PORTS[scheme]!

  if (port < 1 || port > 65535) {
    return null
  }
  return { scheme, host: (hostMatch[1] ?? '').toLowerCase(), port, user, secret }
}

const withoutCredentials = (url: string) => url.replace(/^([a-z]+:\/\/)[^/?#]*@/i, '$1')

const isRefusedHost = (host: string) =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  /^127\./.test(host) ||
  /^169\.254\./.test(host) ||
  /^0\./.test(host) ||
  host === '[::1]' ||
  host === '[::]'

const isPrivateHost = (host: string) =>
  /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)

const deviceOf = (url: string) => {
  const parsed = parseUrl(url)
  return parsed ? `${parsed.scheme}://${parsed.host}:${parsed.port}` : ''
}

const isFlag = (value: unknown) =>
  value === undefined ||
  typeof value === 'boolean' ||
  value === 0 ||
  value === 1 ||
  ['0', '1', 'true', 'false', ''].includes(String(value))

const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true'

const text = (body: Record<string, unknown>, field: string, max: number): string => {
  const value = body[field]

  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value !== 'string') {
    throw new Invalid(field, `${field} must be a string`)
  }
  if (value.length > max) {
    throw new Invalid(field, `${field} is too long`)
  }
  if (/[\x00-\x1f]/.test(value)) {
    throw new Invalid(field, `${field} contains control characters`)
  }
  return value
}

export class VideoBackend {
  sources: StoredSource[] = []
  doorPhones: DoorPhoneSeed[] = []
  checks = new Map<string, CheckResult>()
  unreachableHosts = new Set<string>()
  nodeHosts = new Set<string>()
  publicAddresses = new Map<string, string>()
  limited = false
  private readonly holding = new Set<HoldKind>()
  private readonly waitingRequests: Record<HoldKind, (() => void)[]> = {
    list: [],
    save: [],
    test: [],
    reachability: [],
  }
  private lastGateId = 100

  addSource(source: Partial<StoredSource> & { descr: string; url: string }) {
    this.sources.push({
      user: '',
      secret: '',
      exten: null,
      frameRate: null,
      tlsSkipVerify: false,
      tlsUnpinned: false,
      doorPhone: null,
      profiles: [],
      ...source,
      gates: (source.gates ?? []).map((gate) => ({ ...gate, id: gate.id || this.nextGateId() })),
    })
    return this
  }

  check(url: string, result: CheckResult) {
    this.checks.set(url, result)
    return this
  }

  hold(kind: HoldKind) {
    this.holding.add(kind)
    return this
  }

  release(kind: HoldKind) {
    this.holding.delete(kind)
    for (const release of this.waitingRequests[kind].splice(0)) {
      release()
    }
  }

  waiting(kind: HoldKind): number {
    return this.waitingRequests[kind].length
  }

  private async pass(kind: HoldKind) {
    if (this.holding.has(kind)) {
      await new Promise<void>((resolve) => this.waitingRequests[kind].push(resolve))
    }
  }

  private nextGateId() {
    this.lastGateId += 1
    return this.lastGateId
  }

  private isNodeHost(host: string) {
    return this.limited && this.nodeHosts.has(host)
  }

  private doorPhoneSecretAllowed(mac: string, url: string, current?: StoredSource) {
    const phone = this.doorPhones.find((item) => item.mac === mac)
    const host = parseUrl(url)?.host ?? ''

    if (current?.doorPhone === mac && deviceOf(current.url) === deviceOf(url)) {
      return true
    }
    return (
      !!phone?.ip &&
      (host === phone.ip || host === (this.publicAddresses.get(phone.ip) ?? '').toLowerCase())
    )
  }

  private toApi(source: StoredSource) {
    const firstDtmf = source.gates.find((gate) => gate.type === 'dtmf')
    const type = /^rtsps?:/i.test(source.url) ? 'rtsp' : 'image'
    const permission = permissionOf(source.descr)

    return {
      descr: source.descr,
      type,
      url: source.url,
      user: source.user,
      has_secret: source.secret !== '',
      'frame-rate': source.frameRate,
      exten: source.exten,
      open: firstDtmf?.code ?? '',
      gates: source.gates.map((gate, position) => ({
        id: gate.id,
        position,
        name: gate.name,
        type: gate.type,
        code: gate.code,
        url: gate.url,
        method: gate.method,
        username: gate.type === 'url' ? (gate.username ?? '') : null,
        has_password: gate.password !== '',
        tls_fingerprint: null,
      })),
      tls_skip_verify: source.tlsSkipVerify,
      tls_fingerprint: source.tlsSkipVerify && !source.tlsUnpinned ? 'AA:BB:CC' : null,
      tls_unpinned: source.tlsUnpinned,
      permission,
      gateway_path: type === 'rtsp' ? `streaming-gw/${permission}` : null,
      ...(this.limited
        ? {
            pbx_server: [source.url, ...source.gates.map((gate) => gate.url ?? '')].some((url) =>
              this.nodeHosts.has(parseUrl(url)?.host ?? ''),
            ),
          }
        : {}),
      door_phone: source.doorPhone,
      profiles: source.profiles,
    }
  }

  private doorPhoneApi(phone: DoorPhoneSeed) {
    const ip = phone.ip
    const gates = [1, 2].slice(0, phone.maxGates ?? 1).map((relay) => ({
      relay,
      code: relay === 1 ? phone.dtmfCode : phone.dtmfCode2,
      url: ip ? `http://${ip}/cgi-bin/relay?output=${relay}` : null,
      user: ip ? 'admin' : null,
    }))
    return {
      mac: phone.mac,
      model: phone.model,
      model_name: phone.model_name,
      extension: phone.extension,
      name: phone.name,
      ip,
      registered: ip !== null,
      url: ip ? `rtsp://${ip}:554/h264/stream.live0` : '',
      user: RTSP_USER,
      has_secret: true,
      dtmf_code: phone.dtmfCode,
      dtmf_code_2: phone.dtmfCode2,
      door_gates: gates,
      max_gates: phone.maxGates,
      streams: {
        main: '/h264/stream.live0',
        sub: '/h264/stream.live1',
        main_label: '1280x720',
        sub_label: '640x480',
      },
      sources: this.sources
        .filter((source) => source.exten === phone.extension || source.doorPhone === phone.mac)
        .map((source) => source.descr),
    }
  }

  private validate(body: unknown, current: StoredSource | undefined): StoredSource {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new Invalid('', 'Invalid request')
    }
    const input = body as Record<string, unknown>
    const descr = text(input, 'descr', 1000).trim()

    if (new TextEncoder().encode(descr).length > 50) {
      throw new Invalid('descr', 'descr is too long')
    }
    if (!/[a-zA-Z0-9]/.test(descr)) {
      throw new Invalid('descr', 'name must contain at least a letter or a digit')
    }
    const rawUrl = text(input, 'url', 8000).trim()
    const parsed = parseUrl(rawUrl)

    if (!parsed) {
      throw new Invalid('url', 'URL must be http(s):// or rtsp(s):// with a host')
    }
    if (isRefusedHost(parsed.host)) {
      throw new Invalid(
        'url',
        'the device address is not allowed: loopback and link-local addresses are refused',
      )
    }
    if (this.isNodeHost(parsed.host)) {
      throw new Invalid('url', `the device address is not allowed: ${NODE_REFUSED}`)
    }
    let user = 'user' in input ? text(input, 'user', 255) : (current?.user ?? '')
    let secret = text(input, 'secret', 255)

    if (!user && !secret && parsed.user) {
      user = parsed.user
      secret = parsed.secret
    }
    const exten = input.exten

    if (
      exten !== undefined &&
      exten !== null &&
      exten !== '' &&
      !/^\d{1,10}$/.test(String(exten))
    ) {
      throw new Invalid('exten', 'extension must be a number')
    }
    if (!isFlag(input.tls_skip_verify)) {
      throw new Invalid('tls_skip_verify', 'tls_skip_verify must be a boolean')
    }
    const profiles = input.profiles ?? []

    if (!Array.isArray(profiles)) {
      throw new Invalid('profiles', 'profiles must be a list')
    }
    if (profiles.some((id) => !/^\d{1,10}$/.test(String(id)))) {
      throw new Invalid('profiles', 'invalid profile id')
    }
    let doorPhone = current?.doorPhone ?? null
    const url = withoutCredentials(rawUrl)

    if (input.door_phone !== undefined) {
      const mac = String(input.door_phone)

      if (!MAC.test(mac) || !this.doorPhones.some((phone) => phone.mac === mac)) {
        throw new Invalid('door_phone', 'invalid door phone')
      }
      if (!secret && user === RTSP_USER && !this.doorPhoneSecretAllowed(mac, url, current)) {
        throw new Invalid('secret', DOOR_SECRET_REFUSED)
      }
      doorPhone = mac
    } else if (current?.doorPhone && (secret || deviceOf(current.url) !== deviceOf(url))) {
      doorPhone = null
    }

    if (!user) {
      secret = ''
    } else if (doorPhone && !secret && user === RTSP_USER) {
      secret = 'door-phone-generated'
    } else if (!secret && current) {
      if (current.user !== user && !doorPhone) {
        secret = ''
      } else if (deviceOf(current.url) !== deviceOf(url)) {
        throw new Invalid('secret', 'the device address changed: type the password again')
      } else {
        secret = current.secret
      }
    }
    if (doorPhone && current?.doorPhone && secret !== current.secret && user !== RTSP_USER) {
      doorPhone = null
    }
    const gates = this.validateGates(input.gates, current)

    gates.forEach((gate, index) => {
      if (doorPhone && gate.type === 'dtmf' && !DOOR_DTMF.test(gate.code ?? '')) {
        throw new Invalid(
          `gates[${index}].code`,
          'invalid door phone DTMF code: use 1 to 16 characters among 0-9, A-D, * and #',
        )
      }
    })
    const usesTls =
      /^(rtsps|https):/i.test(url) ||
      gates.some((gate) => gate.type === 'url' && /^https:/i.test(gate.url ?? ''))
    const tlsSkipVerify =
      input.tls_skip_verify === undefined
        ? (current?.tlsSkipVerify ?? false)
        : flag(input.tls_skip_verify)

    return {
      descr,
      url,
      user,
      secret,
      exten: exten === undefined || exten === null || exten === '' ? null : String(exten),
      frameRate: current?.frameRate ?? (/^https?:/i.test(url) ? '1000' : null),
      gates,
      tlsSkipVerify: usesTls && tlsSkipVerify,
      tlsUnpinned: false,
      doorPhone,
      profiles: profiles.map(String),
    }
  }

  private validateGates(raw: unknown, current: StoredSource | undefined): Gate[] {
    if (raw === undefined || raw === null) {
      return current?.gates ?? []
    }
    if (!Array.isArray(raw)) {
      throw new Invalid('gates', 'gates must be a list')
    }
    if (raw.length > MAX_GATES) {
      throw new Invalid('gates', 'too many gates')
    }
    return raw.map((item, index): Gate => {
      if (typeof item !== 'object' || item === null) {
        throw new Invalid(`gates[${index}]`, 'gate must be an object')
      }
      const gate = item as Record<string, unknown>
      const type = gate.type ?? 'dtmf'
      const name = String(gate.name ?? '').trim() || `Door ${index + 1}`
      const stored = current?.gates.find((existing) => existing.id === gate.id)

      if (name.length > 50) {
        throw new Invalid(`gates[${index}].name`, 'name is too long')
      }
      if (type === 'dtmf') {
        const code = String(gate.code ?? '')

        if (!DTMF.test(code)) {
          throw new Invalid(`gates[${index}].code`, 'invalid DTMF code')
        }
        return {
          id: stored?.id ?? this.nextGateId(),
          name,
          type,
          code,
          url: null,
          method: null,
          username: null,
          password: '',
        }
      }
      if (type !== 'url') {
        throw new Invalid(`gates[${index}].type`, 'type must be dtmf or url')
      }
      const url = String(gate.url ?? '').trim()
      const parsed = parseUrl(url)

      if (!parsed || !/^https?$/.test(parsed.scheme) || url.length > 2048) {
        throw new Invalid(`gates[${index}].url`, 'gate URL must be http:// or https://')
      }
      if (isRefusedHost(parsed.host)) {
        throw new Invalid(
          `gates[${index}].url`,
          'the device address is not allowed: loopback and link-local addresses are refused',
        )
      }
      if (this.isNodeHost(parsed.host)) {
        throw new Invalid(
          `gates[${index}].url`,
          `the device address is not allowed: ${NODE_REFUSED}`,
        )
      }
      const method = gate.method ?? 'GET'

      if (method !== 'GET' && method !== 'POST') {
        throw new Invalid(`gates[${index}].method`, 'method must be GET or POST')
      }
      const username = String(gate.username ?? '')
      let password = String(gate.password ?? '')

      if (!username) {
        password = ''
      } else if (!password && stored && stored.password) {
        if (deviceOf(stored.url ?? '') !== deviceOf(url)) {
          throw new Invalid(
            `gates[${index}].password`,
            'the gate address changed: type the password again',
          )
        }
        password = stored.password
      }
      return {
        id: stored?.id ?? this.nextGateId(),
        name,
        type,
        code: null,
        url,
        method,
        username,
        password,
      }
    })
  }

  private conflict(descr: string, except?: string) {
    return this.sources.some(
      (source) => source.descr !== except && permissionOf(source.descr) === permissionOf(descr),
    )
  }

  private async save(
    request: MockRequest,
    current: StoredSource | undefined,
  ): Promise<MockResponse> {
    await this.pass('save')
    try {
      const source = this.validate(request.body, current)

      if (this.conflict(source.descr, current?.descr)) {
        return { status: 409, json: { status: `video source ${source.descr} already exists` } }
      }
      if (current) {
        this.sources = this.sources.map((item) => (item === current ? source : item))
      } else {
        this.sources.push(source)
      }
      return { status: 200 }
    } catch (error) {
      if (error instanceof Invalid) {
        return {
          status: 400,
          json: error.field
            ? { status: error.message, field: error.field }
            : { status: error.message },
        }
      }
      throw error
    }
  }

  private async test(request: MockRequest): Promise<MockResponse> {
    const body = (request.body ?? {}) as Record<string, unknown>
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const parsed = parseUrl(url)

    if (!parsed) {
      return { status: 400, json: { status: 'Invalid source URL' } }
    }
    if (body.door_phone !== undefined && !MAC.test(String(body.door_phone))) {
      return { status: 400, json: { status: 'invalid door phone', field: 'door_phone' } }
    }
    if (
      body.door_phone !== undefined &&
      !body.secret &&
      body.user === RTSP_USER &&
      !this.doorPhoneSecretAllowed(
        String(body.door_phone),
        url,
        this.sources.find((source) => source.descr === body.descr),
      )
    ) {
      return { status: 400, json: { status: DOOR_SECRET_REFUSED, field: 'secret' } }
    }
    if (!isFlag(body.tls_skip_verify)) {
      return {
        status: 400,
        json: { status: 'tls_skip_verify must be a boolean', field: 'tls_skip_verify' },
      }
    }
    await this.pass('test')
    const type = /^rtsps?$/.test(parsed.scheme) ? 'rtsp' : 'image'

    if (type === 'image' && body.details !== true) {
      const result = this.checks.get(url)
      return result?.success ? { json: result.image ?? FRAME } : { status: 500 }
    }
    if (isRefusedHost(parsed.host)) {
      return { json: this.checkBody(type, { success: false, reason: 'address_not_allowed' }) }
    }
    if (this.isNodeHost(parsed.host)) {
      return {
        json: this.checkBody(type, {
          success: false,
          reason: 'address_not_allowed',
          message: NODE_REFUSED,
        }),
      }
    }
    const result = this.checks.get(url) ?? {
      success: false,
      reason: 'timeout',
      message: `${url}: Connection timed out`,
    }
    if (result.secret !== undefined && this.testSecret(body, url) !== result.secret) {
      return {
        json: this.checkBody(type, {
          success: false,
          reason: 'auth_failed',
          message: '401 Unauthorized',
        }),
      }
    }
    return { json: this.checkBody(type, result) }
  }

  private testSecret(body: Record<string, unknown>, url: string): string {
    const user = typeof body.user === 'string' ? body.user : ''
    const secret = typeof body.secret === 'string' ? body.secret : ''
    const stored = this.sources.find((source) => source.descr === body.descr)

    if (
      secret ||
      !user ||
      !stored ||
      stored.user !== user ||
      deviceOf(stored.url) !== deviceOf(url)
    ) {
      return secret
    }
    return stored.secret
  }

  private checkBody(type: string, result: CheckResult) {
    return {
      success: result.success,
      type,
      image: result.success ? (result.image ?? FRAME.replace(/(.{76})/g, '$1\n')) : null,
      mime: result.success ? (result.mime ?? 'image/jpeg') : null,
      video:
        type === 'rtsp' && result.success
          ? (result.video ?? { codec: 'h264', width: 1280, height: 720 })
          : null,
      audio: null,
      h265: result.video?.codec === 'hevc',
      warnings: result.warnings ?? [],
      reason: result.success ? null : (result.reason ?? 'unknown'),
      message: result.message ?? '',
      tls_fingerprint: null,
    }
  }

  install(mockApi: MockApi) {
    const sourceByPath = (path: string) =>
      this.sources.find(
        (source) => source.descr === decodeURIComponent(path.split('/').pop() ?? ''),
      )

    mockApi
      .on('GET', '/freepbx/rest/cti/profiles', { json: PROFILES })
      .on('GET', '/freepbx/rest/physicalextensions', { json: EXTENSIONS })
      .on('GET', '/freepbx/rest/users/:all', { json: USERS })
      .on('GET', '/freepbx/rest/cti/streaming', async () => {
        await this.pass('list')
        return {
          json: [...this.sources]
            .sort((a, b) => a.descr.localeCompare(b.descr))
            .map((source) => this.toApi(source)),
        }
      })
      .on('POST', '/freepbx/rest/cti/streaming', (request) => this.save(request, undefined))
      .on('PUT', '/freepbx/rest/cti/streaming/:descr', (request) => {
        const body = (request.body ?? {}) as Record<string, unknown>
        const currentDescr = typeof body.currentDescr === 'string' ? body.currentDescr : undefined
        const current = currentDescr
          ? this.sources.find((source) => source.descr === currentDescr)
          : sourceByPath(request.path)

        if (!current) {
          return { status: 404, json: { status: `video source ${currentDescr} not found` } }
        }
        return this.save(request, current)
      })
      .on('DELETE', '/freepbx/rest/cti/streaming/:name', (request) => {
        const current = sourceByPath(request.path)

        if (!current) {
          return { status: 404, json: { status: 'video source not found' } }
        }
        this.sources = this.sources.filter((source) => source !== current)
        return { status: 200 }
      })
      .on('POST', '/freepbx/rest/cti/sources/test', (request) => this.test(request))
      .on('GET', '/freepbx/rest/cti/sources/gateway', {
        json: {
          public_ip: PUBLIC_IP,
          ice_hosts: [PUBLIC_IP],
          ice_udp_port: 8189,
          ice_tcp_port: 8189,
          path_prefix: '/streaming-gw/',
        },
      })
      .on('POST', '/freepbx/rest/cti/streaming/reachability', async (request) => {
        await this.pass('reachability')
        const body = (request.body ?? {}) as Record<string, unknown>
        const parsed = typeof body.url === 'string' ? parseUrl(body.url.trim()) : null

        if (!parsed) {
          return { status: 400, json: { status: 'Invalid source URL', field: 'url' } }
        }
        if (body.door_phone !== undefined && !MAC.test(String(body.door_phone))) {
          return { status: 400, json: { status: 'invalid door phone', field: 'door_phone' } }
        }
        const skipped = isRefusedHost(parsed.host) || this.nodeHosts.has(parsed.host)
        const reachable = !skipped && !this.unreachableHosts.has(parsed.host)
        const publicAddress =
          !reachable && body.door_phone !== undefined
            ? (this.publicAddresses.get(parsed.host) ?? null)
            : null
        return {
          json: {
            host: parsed.host,
            port: parsed.port,
            private: isPrivateHost(parsed.host),
            reachable,
            skipped,
            public_address: publicAddress,
            public_url: publicAddress
              ? String(body.url).trim().replace(parsed.host, publicAddress)
              : null,
          },
        }
      })
      .on('GET', '/freepbx/rest/cti/streaming/doorphones', () => ({
        json: this.doorPhones.map((phone) => this.doorPhoneApi(phone)),
      }))
      .on('POST', '/freepbx/rest/cti/streaming/doorphones/:mac', (request) => {
        const mac = request.path.split('/').pop() ?? ''

        if (!MAC.test(mac)) {
          return { status: 400, json: { status: 'invalid door phone' } }
        }
        const phone = this.doorPhones.find((item) => item.mac === mac)

        if (!phone) {
          return { status: 404, json: { status: 'door phone not found' } }
        }
        const api = this.doorPhoneApi(phone)
        return {
          json: {
            descr: phone.name || phone.extension,
            exten: phone.extension,
            url: api.url,
            user: RTSP_USER,
            has_secret: true,
            door_phone: phone.mac,
            streams: api.streams,
            gates: [
              ...(phone.dtmfCode ? [{ name: 'Door 1', type: 'dtmf', code: phone.dtmfCode }] : []),
              ...(phone.dtmfCode2 ? [{ name: 'Door 2', type: 'dtmf', code: phone.dtmfCode2 }] : []),
            ],
            door_gates: api.door_gates,
            max_gates: phone.maxGates,
            ip: phone.ip,
            registered: phone.ip !== null,
            credentials_generated: phone.credentialsGenerated ?? false,
          },
        }
      })
    return this
  }
}

export const MAIN_ENTRANCE_URL = 'rtsp://192.168.1.50:554/h264/stream.live0'
export const PARKING_URL = 'http://192.168.1.51/snapshot.jpg'
export const WAREHOUSE_URL = 'rtsp://192.168.1.52:554/stream1'

export const seedDemo = (backend: VideoBackend) =>
  backend
    .addSource({
      descr: 'Main entrance',
      url: MAIN_ENTRANCE_URL,
      user: RTSP_USER,
      secret: 'door-phone-generated',
      exten: '300',
      doorPhone: '0C-38-3E-32-6B-84',
      profiles: ['1'],
      gates: [
        {
          id: 1,
          name: 'Main gate',
          type: 'dtmf',
          code: '*',
          url: null,
          method: null,
          username: null,
          password: '',
        },
        {
          id: 2,
          name: 'Pedestrian gate',
          type: 'url',
          code: null,
          url: 'http://192.168.1.50/cgi-bin/relay?output=2',
          method: 'GET',
          username: 'admin',
          password: 'relay-secret',
        },
      ],
    })
    .addSource({
      descr: 'Parking gate',
      url: PARKING_URL,
      exten: '301',
      frameRate: '1000',
      profiles: ['3'],
      gates: [
        {
          id: 3,
          name: 'Barrier',
          type: 'dtmf',
          code: '*9',
          url: null,
          method: null,
          username: null,
          password: '',
        },
      ],
    })
    .addSource({
      descr: 'Warehouse',
      url: WAREHOUSE_URL,
      user: 'admin',
      secret: 'Warehouse-1',
      exten: '302',
      profiles: ['1'],
      gates: [
        {
          id: 4,
          name: 'Dock door',
          type: 'dtmf',
          code: '#1',
          url: null,
          method: null,
          username: null,
          password: '',
        },
      ],
    })
    .check(MAIN_ENTRANCE_URL, { success: true })
    .check(PARKING_URL, { success: true })
    .check(WAREHOUSE_URL, {
      success: false,
      reason: 'timeout',
      message:
        '[tcp @ 0x5648c7599dc0] Connection to tcp://192.168.1.52:554?timeout=5000000 failed: Connection timed out\nrtsp://192.168.1.52:554/stream1: Connection timed out',
    })

export const DOOR_PHONES: DoorPhoneSeed[] = [
  {
    mac: '0C-38-3E-32-6B-84',
    model: 'fanvil-i62',
    model_name: 'Fanvil i62',
    extension: '300',
    name: 'Main entrance',
    ip: '192.168.1.50',
    dtmfCode: '*',
    dtmfCode2: '#',
    maxGates: 2,
  },
  {
    mac: '0C-38-3E-32-7C-01',
    model: 'fanvil-i62',
    model_name: 'Fanvil i62',
    extension: '305',
    name: 'Courtyard',
    ip: '192.168.5.218',
    dtmfCode: '*',
    dtmfCode2: '#',
    maxGates: 2,
    credentialsGenerated: true,
  },
  {
    mac: '0C-38-3E-4A-11-20',
    model: 'fanvil-i31s',
    model_name: 'Fanvil i31S',
    extension: '306',
    name: 'Training room',
    ip: null,
    dtmfCode: '*',
    dtmfCode2: null,
    maxGates: 1,
  },
]
