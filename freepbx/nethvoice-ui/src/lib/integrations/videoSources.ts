//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'
import { compareNatural } from '@/lib/common'
import { getLegacyStatusMessage } from './errors'
import { type ExtensionOption, type ProfileOption, toProfileIdNumbers } from './lookups'
import type { FieldIssues } from './validation'

export const VIDEO_SOURCES_KEY = 'videoSources'
export const VIDEO_SOURCE_CHECKS_KEY = 'videoSourceChecks'
export const VIDEO_DOOR_PHONES_KEY = 'videoDoorPhones'
export const VIDEO_GATEWAY_KEY = 'videoGateway'
export const VIDEO_REACHABILITY_KEY = 'videoReachability'

export const VIDEO_SOURCE_NAME_MAX_LENGTH = 50
export const VIDEO_SOURCE_URL_MAX_LENGTH = 8000
export const VIDEO_CREDENTIAL_MAX_LENGTH = 255
export const VIDEO_GATE_NAME_MAX_LENGTH = 50
export const VIDEO_GATE_URL_MAX_LENGTH = 2048
export const VIDEO_DTMF_MAX_LENGTH = 30
export const VIDEO_DOOR_DTMF_MAX_LENGTH = 16
export const VIDEO_SOURCE_MAX_GATES = 10
export const VIDEO_STATUS_CONCURRENCY = 3
export const REACHABILITY_DELAY = 600

const SOURCE_URL_PATTERN = /^(https?|rtsps?):\/\/[^\s/?#]+\S*$/i
const GATE_URL_PATTERN = /^https?:\/\/[^\s/?#]+\S*$/i
const DTMF_PATTERN = /^[0-9A-Da-d*#+]+$/
const DOOR_DTMF_PATTERN = /^[0-9A-Da-d*#]+$/
const EXTENSION_PATTERN = /^\d{1,10}$/
const TLS_URL_PATTERN = /^(rtsps|https):\/\//i
const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443, rtsp: 554, rtsps: 322 }

type VideoSourceInput = components['schemas']['VideoSourceInput'] & { currentDescr?: string }
type VideoSourceGateInput = components['schemas']['VideoSourceGate']

export type VideoSourceType = 'image' | 'rtsp'
export type GateType = 'dtmf' | 'url'
export type GateMethod = 'GET' | 'POST'
export type DeviceType = 'other' | 'fanvil'
export type StreamQuality = 'main' | 'sub' | ''
export type VideoSourceStatus = 'testing' | 'connected' | 'notConnected'
export type CheckReason =
  | 'auth_failed'
  | 'connection_refused'
  | 'timeout'
  | 'not_found'
  | 'tls_error'
  | 'unsupported'
  | 'address_not_allowed'
  | 'unknown'
export type CheckWarning =
  'h265' | 'codec_not_supported_by_webrtc' | 'preview_failed' | 'tls_certificate_changed'

export type VideoSourceGate = {
  id: number | null
  name: string
  type: GateType
  code: string
  url: string
  method: GateMethod
  username: string
  hasPassword: boolean
}

export type VideoSource = {
  name: string
  type: VideoSourceType
  url: string
  user: string
  hasSecret: boolean
  extension: string
  gates: VideoSourceGate[]
  tlsSkipVerify: boolean
  tlsUnpinned: boolean
  doorPhone: string
  profileIds: string[]
}

export type VideoStreams = { main: string; sub: string; mainLabel: string; subLabel: string }

export type DoorRelay = { relay: number; code: string; url: string; user: string }

export type DoorPhone = {
  mac: string
  modelName: string
  extension: string
  name: string
  ip: string
  registered: boolean
  url: string
  maxGates: number | null
  relays: DoorRelay[]
  streams: VideoStreams | null
  sources: string[]
}

export type DoorPhonePrefill = {
  name: string
  extension: string
  url: string
  user: string
  doorPhone: string
  streams: VideoStreams | null
  gates: { name: string; code: string }[]
  relays: DoorRelay[]
  maxGates: number | null
  registered: boolean
  credentialsGenerated: boolean
}

export type DoorContext = {
  streams: VideoStreams | null
  relays: DoorRelay[]
  maxGates: number | null
}

export type VideoSourceCheck = {
  success: boolean
  type: VideoSourceType
  imageUrl: string
  mime: string
  video: { codec: string; width: number; height: number } | null
  warnings: CheckWarning[]
  reason: CheckReason | null
  message: string
}

export type StoredCheck = { signature: string; check: VideoSourceCheck }

export type Reachability = {
  host: string
  port: number
  private: boolean
  reachable: boolean
  publicAddress: string
}

export type GatewayInfo = { publicIp: string }

export type GateForm = {
  uid: string
  id: number | null
  name: string
  type: GateType
  code: string
  url: string
  method: GateMethod
  username: string
  password: string
  hasPassword: boolean
}

export type VideoSourceForm = {
  name: string
  extension: string
  profileIds: string[]
  deviceType: DeviceType
  quality: StreamQuality
  url: string
  user: string
  password: string
  tlsSkipVerify: boolean
  doorPhone: string
  ownCredentials: boolean
  gates: GateForm[]
}

export const FANVIL_STREAMS: VideoStreams = {
  main: '/h264/stream.live0',
  sub: '/h264/stream.live1',
  mainLabel: '',
  subLabel: '640 × 480',
}

const FANVIL_PORT = 554

const IdSchema = v.pipe(v.union([v.number(), v.string()]), v.transform(String))
const TextSchema = v.pipe(
  v.optional(v.nullable(v.union([v.string(), v.number()])), ''),
  v.transform((value) => (value === null || value === undefined ? '' : String(value))),
)
const FlagSchema = v.pipe(
  v.optional(v.nullable(v.union([v.boolean(), v.number(), v.string()])), false),
  v.transform((value) => value === true || value === 1 || value === '1' || value === 'true'),
)

const GateSchema = v.object({
  id: v.optional(v.nullable(v.number()), null),
  name: TextSchema,
  type: v.optional(v.nullable(v.picklist(['dtmf', 'url'])), 'dtmf'),
  code: TextSchema,
  url: TextSchema,
  method: v.optional(v.nullable(v.picklist(['GET', 'POST'])), 'GET'),
  username: TextSchema,
  has_password: FlagSchema,
})

const SourceSchema = v.object({
  descr: v.string(),
  type: v.optional(v.nullable(v.picklist(['image', 'rtsp'])), null),
  url: TextSchema,
  user: TextSchema,
  has_secret: FlagSchema,
  exten: TextSchema,
  gates: v.optional(v.nullable(v.array(GateSchema)), []),
  tls_skip_verify: FlagSchema,
  tls_unpinned: FlagSchema,
  door_phone: TextSchema,
  profiles: v.optional(v.nullable(v.array(IdSchema)), []),
})

const StreamsSchema = v.nullish(
  v.object({
    main: TextSchema,
    sub: TextSchema,
    main_label: TextSchema,
    sub_label: TextSchema,
  }),
  null,
)

const RelaySchema = v.object({
  relay: v.number(),
  code: TextSchema,
  url: TextSchema,
  user: TextSchema,
})

const DoorPhoneSchema = v.object({
  mac: v.string(),
  model_name: TextSchema,
  model: TextSchema,
  extension: TextSchema,
  name: TextSchema,
  ip: TextSchema,
  registered: FlagSchema,
  url: TextSchema,
  max_gates: v.optional(v.nullable(v.number()), null),
  door_gates: v.optional(v.nullable(v.array(RelaySchema)), []),
  streams: StreamsSchema,
  sources: v.optional(v.nullable(v.array(v.string())), []),
})

const PrefillSchema = v.object({
  descr: TextSchema,
  exten: TextSchema,
  url: TextSchema,
  user: TextSchema,
  door_phone: v.string(),
  streams: StreamsSchema,
  gates: v.optional(
    v.nullable(v.array(v.object({ name: TextSchema, type: TextSchema, code: TextSchema }))),
    [],
  ),
  door_gates: v.optional(v.nullable(v.array(RelaySchema)), []),
  max_gates: v.optional(v.nullable(v.number()), null),
  registered: FlagSchema,
  credentials_generated: FlagSchema,
})

const WARNINGS: CheckWarning[] = [
  'h265',
  'codec_not_supported_by_webrtc',
  'preview_failed',
  'tls_certificate_changed',
]
const REASONS: CheckReason[] = [
  'auth_failed',
  'connection_refused',
  'timeout',
  'not_found',
  'tls_error',
  'unsupported',
  'address_not_allowed',
  'unknown',
]

const CheckSchema = v.object({
  success: FlagSchema,
  type: v.optional(v.nullable(v.picklist(['image', 'rtsp'])), 'image'),
  image: TextSchema,
  mime: TextSchema,
  video: v.optional(
    v.nullable(
      v.object({
        codec: TextSchema,
        width: v.optional(v.nullable(v.number()), 0),
        height: v.optional(v.nullable(v.number()), 0),
      }),
    ),
    null,
  ),
  warnings: v.optional(v.nullable(v.array(v.string())), []),
  reason: v.optional(v.nullable(v.string()), null),
  message: TextSchema,
})

const ReachabilitySchema = v.object({
  host: TextSchema,
  port: v.number(),
  private: FlagSchema,
  reachable: FlagSchema,
  public_address: TextSchema,
})

const GatewaySchema = v.object({ public_ip: TextSchema })

const formatResolution = (label: string) =>
  label.trim().replace(/^(\d+)\s*[x×]\s*(\d+)$/i, '$1 × $2')

const toStreams = (raw: v.InferOutput<typeof StreamsSchema>): VideoStreams | null =>
  raw && raw.main
    ? {
        main: raw.main,
        sub: raw.sub,
        mainLabel: formatResolution(raw.main_label),
        subLabel: formatResolution(raw.sub_label),
      }
    : null

const toRelays = (raw: v.InferOutput<typeof RelaySchema>[] | null): DoorRelay[] =>
  (raw ?? []).map((relay) => ({ ...relay })).sort((a, b) => a.relay - b.relay)

export const isRtspUrl = (url: string): boolean => /^rtsps?:\/\//i.test(url.trim())

export const parseVideoSources = (raw: unknown): VideoSource[] =>
  v
    .parse(v.array(SourceSchema), raw)
    .map((source) => ({
      name: source.descr,
      type: source.type ?? (isRtspUrl(source.url) ? 'rtsp' : 'image'),
      url: source.url,
      user: source.user,
      hasSecret: source.has_secret,
      extension: source.exten === '0' ? '' : source.exten,
      gates: (source.gates ?? []).map((gate) => ({
        id: gate.id,
        name: gate.name,
        type: gate.type ?? 'dtmf',
        code: gate.code,
        url: gate.url,
        method: gate.method ?? 'GET',
        username: gate.username,
        hasPassword: gate.has_password,
      })),
      tlsSkipVerify: source.tls_skip_verify,
      tlsUnpinned: source.tls_unpinned,
      doorPhone: source.door_phone,
      profileIds: source.profiles ?? [],
    }))
    .sort((a, b) => compareNatural(a.name, b.name))

export const parseDoorPhones = (raw: unknown): DoorPhone[] =>
  v
    .parse(v.array(DoorPhoneSchema), raw)
    .map((phone) => ({
      mac: phone.mac,
      modelName: phone.model_name || phone.model,
      extension: phone.extension,
      name: phone.name,
      ip: phone.ip,
      registered: phone.registered,
      url: phone.url,
      maxGates: phone.max_gates,
      relays: toRelays(phone.door_gates),
      streams: toStreams(phone.streams),
      sources: phone.sources ?? [],
    }))
    .sort((a, b) => compareNatural(a.extension, b.extension))

export const parseDoorPhonePrefill = (raw: unknown): DoorPhonePrefill => {
  const prefill = v.parse(PrefillSchema, raw)

  return {
    name: prefill.descr,
    extension: prefill.exten,
    url: prefill.url,
    user: prefill.user,
    doorPhone: prefill.door_phone,
    streams: toStreams(prefill.streams),
    gates: (prefill.gates ?? [])
      .filter((gate) => gate.type !== 'url')
      .map((gate) => ({ name: gate.name, code: gate.code })),
    relays: toRelays(prefill.door_gates),
    maxGates: prefill.max_gates,
    registered: prefill.registered,
    credentialsGenerated: prefill.credentials_generated,
  }
}

export const parseVideoSourceCheck = (raw: unknown): VideoSourceCheck => {
  const check = v.parse(CheckSchema, raw)
  const image = check.image.replace(/\s+/g, '')
  const mime = check.mime || (image ? 'image/jpeg' : '')
  const reason = REASONS.find((known) => known === check.reason) ?? null

  return {
    success: check.success,
    type: check.type ?? 'image',
    imageUrl: image ? `data:${mime};base64,${image}` : '',
    mime,
    video:
      check.video && check.video.codec
        ? {
            codec: check.video.codec,
            width: check.video.width ?? 0,
            height: check.video.height ?? 0,
          }
        : null,
    warnings: WARNINGS.filter((warning) => (check.warnings ?? []).includes(warning)),
    reason: check.success ? null : (reason ?? 'unknown'),
    message: check.message,
  }
}

export const failedCheck = (message = '', reason: CheckReason = 'unknown'): VideoSourceCheck => ({
  success: false,
  type: 'image',
  imageUrl: '',
  mime: '',
  video: null,
  warnings: [],
  reason,
  message,
})

export const parseReachability = (raw: unknown): Reachability => {
  const reachability = v.parse(ReachabilitySchema, raw)

  return {
    host: reachability.host,
    port: reachability.port,
    private: reachability.private,
    reachable: reachability.reachable,
    publicAddress: reachability.public_address,
  }
}

export const parseGateway = (raw: unknown): GatewayInfo => ({
  publicIp: v.parse(GatewaySchema, raw).public_ip,
})

export const isSourceUrl = (url: string): boolean => SOURCE_URL_PATTERN.test(url.trim())

export const isTlsUrl = (url: string): boolean => TLS_URL_PATTERN.test(url.trim())

export const isTlsRelevant = (form: Pick<VideoSourceForm, 'url' | 'gates'>): boolean =>
  isTlsUrl(form.url) ||
  form.gates.some((gate) => gate.type === 'url' && /^https:\/\//i.test(gate.url.trim()))

const AUTHORITY_PATTERN = /^([a-z][a-z0-9+.-]*:\/\/)((?:[^@/?#]*@)?)(\[[^\]]+\]|[^:/?#]+)(:\d+)?/i

export const reachabilityKey = (url: string): string => {
  const match = AUTHORITY_PATTERN.exec(url.trim())
  const scheme = match?.[1]?.slice(0, -3).toLowerCase() ?? ''

  if (!match || !isSourceUrl(url) || !DEFAULT_PORTS[scheme]) {
    return ''
  }
  const port = match[4] ? match[4].slice(1) : String(DEFAULT_PORTS[scheme])
  return `${match[3]?.toLowerCase()}:${port}`
}

export const replaceUrlHost = (url: string, host: string): string => {
  const match = AUTHORITY_PATTERN.exec(url.trim())

  if (!match || !host) {
    return url
  }
  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `${match[1]}${match[2]}${bracketed}${match[4] ?? ''}${url.trim().slice(match[0].length)}`
}

const splitRtspUrl = (url: string) => {
  const match = /^(rtsps?:\/\/[^/?#]+)([^?#]*)(.*)$/i.exec(url.trim())
  return match ? { base: match[1] ?? '', path: match[2] ?? '', rest: match[3] ?? '' } : null
}

const hostOf = (url: string): string => AUTHORITY_PATTERN.exec(url.trim())?.[3] ?? ''

export const detectDeviceType = (url: string): DeviceType => {
  const parts = splitRtspUrl(url)

  return parts &&
    new RegExp(`:${FANVIL_PORT}$`).test(parts.base) &&
    (parts.path === FANVIL_STREAMS.main || parts.path === FANVIL_STREAMS.sub)
    ? 'fanvil'
    : 'other'
}

export const detectQuality = (url: string, streams: VideoStreams | null): StreamQuality => {
  const parts = splitRtspUrl(url)

  if (!streams || !parts) {
    return ''
  }
  if (parts.path === streams.main) {
    return 'main'
  }
  return parts.path === streams.sub ? 'sub' : ''
}

export const hasQualityChoice = (url: string, streams: VideoStreams | null): boolean =>
  !!streams && !!streams.main && !!streams.sub && (url.trim() === '' || isRtspUrl(url))

export const applyQuality = (
  url: string,
  streams: VideoStreams | null,
  quality: StreamQuality,
): string => {
  const parts = splitRtspUrl(url)
  const path = quality && streams ? streams[quality] : ''

  return parts && path ? `${parts.base}${path}${parts.rest}` : url
}

export const applyDeviceType = (url: string, deviceType: DeviceType): string => {
  const host = hostOf(url)

  if (deviceType !== 'fanvil' || !host || detectDeviceType(url) === 'fanvil') {
    return url
  }
  return `rtsp://${host}:${FANVIL_PORT}${FANVIL_STREAMS.main}`
}

export const streamsOf = (deviceType: DeviceType, context: DoorContext | null) =>
  context?.streams ?? (deviceType === 'fanvil' ? FANVIL_STREAMS : null)

let lastGateUid = 0

export const newGateUid = (): string => {
  lastGateUid += 1
  return `g${lastGateUid}`
}

export const newGateForm = (name = ''): GateForm => ({
  uid: newGateUid(),
  id: null,
  name,
  type: 'dtmf',
  code: '',
  url: '',
  method: 'GET',
  username: '',
  password: '',
  hasPassword: false,
})

export const findProfileIdByName = (profiles: ProfileOption[], name: string): string =>
  profiles.find((profile) => profile.name.trim().toLowerCase() === name.toLowerCase())?.id ?? ''

export const defaultProfileIds = (
  profiles: ProfileOption[],
  extensionProfileId: string = '',
): string[] => {
  if (extensionProfileId && profiles.some((profile) => profile.id === extensionProfileId)) {
    return [extensionProfileId]
  }
  const base = findProfileIdByName(profiles, 'base')
  return base ? [base] : []
}

export const profileOfExtension = (
  users: { mainExtension: string; profileId: number | null; devices: { extension: string }[] }[],
  extension: string,
): string => {
  const user = users.find(
    (item) =>
      item.profileId !== null &&
      (item.mainExtension === extension ||
        item.devices.some((device) => device.extension === extension)),
  )
  return user?.profileId === null || user === undefined ? '' : String(user.profileId)
}

export const emptyVideoSourceForm = (profileIds: string[] = []): VideoSourceForm => ({
  name: '',
  extension: '',
  profileIds: [...profileIds],
  deviceType: 'other',
  quality: '',
  url: '',
  user: '',
  password: '',
  tlsSkipVerify: false,
  doorPhone: '',
  ownCredentials: false,
  gates: [],
})

export const relayOf = (relays: DoorRelay[], index: number): DoorRelay | undefined =>
  relays.find((relay) => relay.relay === index + 1)

export const isGateCodeLocked = (gate: GateForm, index: number, relays: DoorRelay[]): boolean =>
  gate.type === 'dtmf' && !!relayOf(relays, index)?.code

export const syncDoorGates = (gates: GateForm[], relays: DoorRelay[]): GateForm[] =>
  gates.map((gate, index) => {
    const relay = relayOf(relays, index)

    if (!relay) {
      return gate
    }
    if (gate.type === 'dtmf' && relay.code) {
      return { ...gate, code: relay.code }
    }
    if (gate.type === 'url' && !gate.url.trim() && relay.url) {
      return {
        ...gate,
        url: relay.url,
        method: 'GET',
        username: gate.username || relay.user,
      }
    }
    return gate
  })

export const toVideoSourceForm = (
  source: VideoSource,
  context: DoorContext | null = null,
): VideoSourceForm => {
  const deviceType = source.doorPhone
    ? context?.streams
      ? 'fanvil'
      : 'other'
    : detectDeviceType(source.url)

  return {
    name: source.name,
    extension: source.extension,
    profileIds: [...source.profileIds],
    deviceType,
    quality: detectQuality(source.url, streamsOf(deviceType, context)),
    url: source.url,
    user: source.user,
    password: '',
    tlsSkipVerify: source.tlsSkipVerify,
    doorPhone: source.doorPhone,
    ownCredentials: false,
    gates: syncDoorGates(
      source.gates.map((gate) => ({ ...gate, uid: newGateUid(), password: '' })),
      source.doorPhone ? (context?.relays ?? []) : [],
    ),
  }
}

export const fromDoorPhonePrefill = (
  prefill: DoorPhonePrefill,
  profileIds: string[],
): VideoSourceForm => {
  const deviceType = prefill.streams ? 'fanvil' : 'other'

  return {
    ...emptyVideoSourceForm(profileIds),
    name: prefill.name,
    extension: prefill.extension,
    deviceType,
    quality: detectQuality(prefill.url, prefill.streams),
    url: prefill.url,
    user: prefill.user,
    doorPhone: prefill.doorPhone,
    gates: syncDoorGates(
      prefill.gates.map((gate) => ({ ...newGateForm(gate.name), code: gate.code })),
      prefill.relays,
    ),
  }
}

export const usesDoorPhoneCredentials = (
  form: Pick<VideoSourceForm, 'doorPhone' | 'ownCredentials'>,
): boolean => !!form.doorPhone && !form.ownCredentials

export const gateLimit = (doorPhone: string, maxGates: number | null): number =>
  doorPhone && maxGates ? Math.min(maxGates, VIDEO_SOURCE_MAX_GATES) : VIDEO_SOURCE_MAX_GATES

export const connectionSignature = (form: VideoSourceForm): string => {
  const doorCredentials = usesDoorPhoneCredentials(form)

  return JSON.stringify([
    form.url.trim(),
    doorCredentials ? '' : form.user.trim(),
    doorCredentials || !form.user.trim() ? '' : form.password,
    isTlsUrl(form.url) && form.tlsSkipVerify,
    doorCredentials ? form.doorPhone : '',
  ])
}

export const sourceSignature = (source: VideoSource): string =>
  JSON.stringify([
    source.url,
    source.user,
    source.hasSecret,
    source.tlsSkipVerify,
    source.doorPhone,
  ])

export const getVideoSourcePermissionName = (name: string): string =>
  `vs_${name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/ /g, '_')
    .toLowerCase()}`

const byteLength = (text: string) => new TextEncoder().encode(text).length

export const validateConnection = (form: VideoSourceForm): FieldIssues => {
  const issues: FieldIssues = {}
  const url = form.url.trim()

  if (!url) {
    issues.url = 'integrations.video.url_required'
  } else if (!isSourceUrl(url)) {
    issues.url = 'integrations.video.url_invalid'
  } else if (url.length > VIDEO_SOURCE_URL_MAX_LENGTH) {
    issues.url = 'integrations.video.url_too_long'
  }
  if (usesDoorPhoneCredentials(form)) {
    return issues
  }
  if (form.user.trim().length > VIDEO_CREDENTIAL_MAX_LENGTH) {
    issues.user = 'integrations.video.credential_too_long'
  }
  if (form.password.length > VIDEO_CREDENTIAL_MAX_LENGTH) {
    issues.password = 'integrations.video.credential_too_long'
  } else if (form.doorPhone && form.user.trim() && !form.password) {
    issues.password = 'integrations.video.door_phone_password_required'
  }
  return issues
}

export const validateSourceFields = (
  form: VideoSourceForm,
  otherSources: Pick<VideoSource, 'name'>[],
): FieldIssues => {
  const issues: FieldIssues = {}
  const name = form.name.trim()
  const permissionName = getVideoSourcePermissionName(name)

  if (!name) {
    issues.name = 'integrations.video.name_required'
  } else if (byteLength(name) > VIDEO_SOURCE_NAME_MAX_LENGTH) {
    issues.name = 'integrations.video.name_too_long'
  } else if (/[/\\]/.test(name) || !/[a-zA-Z0-9]/.test(name)) {
    issues.name = 'integrations.video.name_invalid'
  } else if (
    otherSources.some((source) => getVideoSourcePermissionName(source.name) === permissionName)
  ) {
    issues.name = 'integrations.video.name_already_used'
  }
  if (form.extension && !EXTENSION_PATTERN.test(form.extension)) {
    issues.extension = 'integrations.video.extension_invalid'
  }
  if (form.profileIds.length === 0) {
    issues.profileIds = 'integrations.profiles_required'
  }
  return { ...issues, ...validateConnection(form) }
}

export const gateIssueKey = (uid: string, field: string) => `gates.${uid}.${field}`

const ISSUE_PARAMS: Record<string, Record<string, number>> = {
  'integrations.video.name_too_long': { max: VIDEO_SOURCE_NAME_MAX_LENGTH },
  'integrations.video.credential_too_long': { max: VIDEO_CREDENTIAL_MAX_LENGTH },
  'integrations.video.dtmf_too_long': { max: VIDEO_DTMF_MAX_LENGTH },
  'integrations.video.door_dtmf_invalid': { max: VIDEO_DOOR_DTMF_MAX_LENGTH },
  'integrations.video.too_many_gates': { max: VIDEO_SOURCE_MAX_GATES },
}

export const issueParams = (issue: string): Record<string, number> => ISSUE_PARAMS[issue] ?? {}

const validateDtmf = (code: string, door: boolean): string => {
  if (!code) {
    return 'integrations.video.dtmf_required'
  }
  if (door) {
    return DOOR_DTMF_PATTERN.test(code) && code.length <= VIDEO_DOOR_DTMF_MAX_LENGTH
      ? ''
      : 'integrations.video.door_dtmf_invalid'
  }
  if (!DTMF_PATTERN.test(code)) {
    return 'integrations.video.dtmf_invalid'
  }
  return code.length > VIDEO_DTMF_MAX_LENGTH ? 'integrations.video.dtmf_too_long' : ''
}

export const validateGates = (form: VideoSourceForm, limit: number): FieldIssues => {
  const issues: FieldIssues = {}
  const door = usesDoorPhoneCredentials(form)

  form.gates.forEach((gate) => {
    const name = gate.name.trim()

    if (!name) {
      issues[gateIssueKey(gate.uid, 'name')] = 'integrations.video.gate_name_required'
    } else if (byteLength(name) > VIDEO_GATE_NAME_MAX_LENGTH) {
      issues[gateIssueKey(gate.uid, 'name')] = 'integrations.video.name_too_long'
    }
    if (gate.type === 'dtmf') {
      const issue = validateDtmf(gate.code.trim(), door)

      if (issue) {
        issues[gateIssueKey(gate.uid, 'code')] = issue
      } else if (!form.extension) {
        issues[gateIssueKey(gate.uid, 'code')] = 'integrations.video.dtmf_needs_extension'
      }
      return
    }
    const url = gate.url.trim()

    if (!url) {
      issues[gateIssueKey(gate.uid, 'url')] = 'integrations.video.gate_url_required'
    } else if (!GATE_URL_PATTERN.test(url)) {
      issues[gateIssueKey(gate.uid, 'url')] = 'integrations.video.gate_url_invalid'
    } else if (url.length > VIDEO_GATE_URL_MAX_LENGTH) {
      issues[gateIssueKey(gate.uid, 'url')] = 'integrations.video.url_too_long'
    }
    if (gate.username.trim().length > VIDEO_CREDENTIAL_MAX_LENGTH) {
      issues[gateIssueKey(gate.uid, 'username')] = 'integrations.video.credential_too_long'
    }
    if (gate.password.length > VIDEO_CREDENTIAL_MAX_LENGTH) {
      issues[gateIssueKey(gate.uid, 'password')] = 'integrations.video.credential_too_long'
    }
  })
  if (form.gates.length > limit) {
    issues.gates = 'integrations.video.too_many_gates'
  }
  if (!form.extension && form.gates.some((gate) => gate.type === 'dtmf')) {
    issues.extension = 'integrations.video.dtmf_needs_extension'
  }
  return issues
}

export const firstGateIssueUids = (issues: FieldIssues): string[] => [
  ...new Set(
    Object.keys(issues)
      .filter((key) => key.startsWith('gates.') && key.split('.').length === 3)
      .map((key) => key.split('.')[1] ?? ''),
  ),
]

const toGatePayload = (gate: GateForm): VideoSourceGateInput => {
  const base = { ...(gate.id === null ? {} : { id: gate.id }), name: gate.name.trim() }

  if (gate.type === 'dtmf') {
    return { ...base, type: 'dtmf', code: gate.code.trim() }
  }
  const username = gate.username.trim()

  return {
    ...base,
    type: 'url',
    url: gate.url.trim(),
    method: gate.method,
    username,
    password: username ? gate.password : '',
  }
}

const credentialsPayload = (form: VideoSourceForm) => {
  const user = form.user.trim()
  const door = usesDoorPhoneCredentials(form)

  return {
    user,
    secret: user && !door ? form.password : '',
    ...(door ? { door_phone: form.doorPhone } : {}),
  }
}

export const buildVideoSourcePayload = (
  form: VideoSourceForm,
  existing?: Pick<VideoSource, 'name'>,
): VideoSourceInput => ({
  ...(existing ? { currentDescr: existing.name } : {}),
  descr: form.name.trim(),
  url: form.url.trim(),
  ...credentialsPayload(form),
  exten: form.extension || null,
  tls_skip_verify: isTlsRelevant(form) && form.tlsSkipVerify,
  profiles: toProfileIdNumbers(form.profileIds),
  gates: form.gates.map(toGatePayload),
})

export type CheckPayload = {
  url: string
  user: string
  secret: string
  tls_skip_verify: boolean
  details: true
  descr?: string
  door_phone?: string
}

export const buildCheckPayload = (
  form: VideoSourceForm,
  existing?: Pick<VideoSource, 'name'>,
): CheckPayload => ({
  url: form.url.trim(),
  ...credentialsPayload(form),
  tls_skip_verify: isTlsUrl(form.url) && form.tlsSkipVerify,
  details: true,
  ...(existing ? { descr: existing.name } : {}),
})

export const buildStoredCheckPayload = (source: VideoSource): CheckPayload => ({
  url: source.url,
  user: source.user,
  secret: '',
  tls_skip_verify: source.tlsSkipVerify,
  details: true,
  descr: source.name,
  ...(source.doorPhone ? { door_phone: source.doorPhone } : {}),
})

export const FAILURE_KEYS: Record<CheckReason, string> = {
  timeout: 'integrations.video.failure_timeout',
  auth_failed: 'integrations.video.failure_auth_failed',
  connection_refused: 'integrations.video.failure_connection_refused',
  not_found: 'integrations.video.failure_not_found',
  tls_error: 'integrations.video.failure_tls_error',
  unsupported: 'integrations.video.failure_unsupported',
  address_not_allowed: 'integrations.video.failure_address_not_allowed',
  unknown: 'integrations.video.failure_unknown',
}

export const ADDRESS_ISSUES: [RegExp, string][] = [
  [/addresses of the PBX node/, 'integrations.video.address_of_pbx'],
  [/loopback and link-local/, 'integrations.video.address_loopback'],
]

export const getAddressIssue = (message: string): string =>
  ADDRESS_ISSUES.find(([pattern]) => pattern.test(message))?.[1] ??
  'integrations.video.failure_address_not_allowed'

export const getFailureKey = (check: Pick<VideoSourceCheck, 'reason' | 'message'>): string =>
  check.reason === 'address_not_allowed'
    ? getAddressIssue(check.message)
    : FAILURE_KEYS[check.reason ?? 'unknown']

export const statusOfCheck = (check: VideoSourceCheck): VideoSourceStatus =>
  check.success ? 'connected' : 'notConnected'

const MIME_LABELS: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG' }

export const formatVideoInfo = (
  check: Pick<VideoSourceCheck, 'video' | 'mime' | 'type'>,
  naturalSize?: { width: number; height: number },
): string => {
  const size = (width: number, height: number) =>
    width > 0 && height > 0 ? `, ${width} × ${height}` : ''

  if (check.video) {
    return `${check.video.codec.toUpperCase()}${size(check.video.width, check.video.height)}`
  }
  const label = MIME_LABELS[check.mime]

  if (check.type !== 'image' || !label) {
    return ''
  }
  return `${label}${naturalSize ? size(naturalSize.width, naturalSize.height) : ''}`
}

export const describeExtension = (extension: string, options: ExtensionOption[]): string => {
  if (!extension) {
    return '-'
  }
  const name = options.find((option) => option.extension === extension)?.name
  return name ? `${name} (${extension})` : extension
}

const MESSAGE_KEYS: [RegExp, string][] = [
  ...ADDRESS_ISSUES,
  [/address is not allowed/, 'integrations.video.failure_address_not_allowed'],
  [/door phone password is sent only/, 'integrations.video.door_phone_password_not_allowed'],
  [/door phone not found|invalid door phone$/, 'integrations.video.door_phone_not_found'],
  [/invalid door phone DTMF code/, 'integrations.video.door_dtmf_invalid'],
  [/address changed: type the password again/, 'integrations.video.password_address_changed'],
  [/certificate changed: type the password again/, 'integrations.video.password_cert_changed'],
  [/could not read the TLS certificate/, 'integrations.video.tls_certificate_unreadable'],
  [/invalid DTMF code/, 'integrations.video.dtmf_invalid'],
  [/too many gates/, 'integrations.video.too_many_gates'],
  [/at least a letter or a digit/, 'integrations.video.name_invalid'],
  [/^URL must be/, 'integrations.video.url_invalid'],
  [/^gate URL must be/, 'integrations.video.gate_url_invalid'],
  [/extension must be a number/, 'integrations.video.extension_invalid'],
  [/is too long$/, 'integrations.video.value_too_long'],
  [/invalid profile id/, 'integrations.video.profiles_invalid'],
]

const FIELD_NAMES: Record<string, string> = {
  descr: 'name',
  url: 'url',
  user: 'user',
  secret: 'password',
  exten: 'extension',
  profiles: 'profileIds',
  tls_skip_verify: 'tlsSkipVerify',
  gates: 'gates',
}

const GATE_FIELDS: Record<string, string> = {
  code: 'code',
  url: 'url',
  method: 'method',
  password: 'password',
  type: 'type',
  name: 'name',
  username: 'username',
}

export type SaveErrorMapping = { issues: FieldIssues; message: string }

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const isDoorPasswordRequest = (issues: FieldIssues): boolean =>
  issues.password === 'integrations.video.door_phone_password_not_allowed'

export const mapSaveError = (error: unknown, gates: GateForm[]): SaveErrorMapping => {
  if (!isApiError(error) || error.status >= 500 || error.status === 404) {
    return { issues: {}, message: '' }
  }
  if (error.status === 409) {
    return { issues: { name: 'integrations.video.name_already_used' }, message: '' }
  }
  const status = getLegacyStatusMessage(error)
  const body: unknown = error.body
  const field =
    typeof body === 'object' && body !== null && 'field' in body && typeof body.field === 'string'
      ? body.field
      : ''
  const text = MESSAGE_KEYS.find(([pattern]) => pattern.test(status))?.[1] ?? capitalize(status)
  const gateMatch = /^gates\[(\d+)\](?:\.(\w+))?$/.exec(field)

  if (gateMatch) {
    const gate = gates[Number(gateMatch[1])]
    const gateField = GATE_FIELDS[gateMatch[2] ?? ''] ?? 'name'

    return gate
      ? { issues: { [gateIssueKey(gate.uid, gateField)]: text }, message: '' }
      : { issues: {}, message: text }
  }
  const formField = FIELD_NAMES[field]

  return formField ? { issues: { [formField]: text }, message: '' } : { issues: {}, message: text }
}

export const createLimitedQueue = (limit: number) => {
  let running = 0
  const waiting: (() => void)[] = []

  const next = () => {
    if (running >= limit) {
      return
    }
    const start = waiting.shift()

    if (start) {
      running += 1
      start()
    }
  }

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        waiting.push(() => {
          task()
            .then(resolve, reject)
            .finally(() => {
              running -= 1
              next()
            })
        })
        next()
      })
    },
    get size() {
      return running + waiting.length
    },
  }
}

export const getVideoSources = async (): Promise<VideoSource[]> => {
  const { data } = await api.GET('/cti/streaming')
  return parseVideoSources(data)
}

export const getDoorPhones = async (): Promise<DoorPhone[]> => {
  const { data } = await api.GET('/cti/streaming/doorphones')
  return parseDoorPhones(data)
}

export const prepareDoorPhone = async (mac: string): Promise<DoorPhonePrefill> => {
  const { data } = await api.POST('/cti/streaming/doorphones/{mac}', {
    params: { path: { mac } },
  })
  return parseDoorPhonePrefill(data)
}

export const getGateway = async (): Promise<GatewayInfo> => {
  const { data } = await api.GET('/cti/sources/gateway')
  return parseGateway(data)
}

export const checkReachability = async (
  url: string,
  doorPhone: string,
  signal?: AbortSignal,
): Promise<Reachability> => {
  const { data } = await api.POST('/cti/streaming/reachability', {
    body: { url: url.trim(), ...(doorPhone ? { door_phone: doorPhone } : {}) },
    signal,
  })
  return parseReachability(data)
}

export const testVideoSource = async (
  payload: CheckPayload,
  signal?: AbortSignal,
): Promise<VideoSourceCheck> => {
  const { data } = await api.POST('/cti/sources/test', { body: payload, signal })
  return parseVideoSourceCheck(data)
}

export const checkStoredVideoSource = async (
  source: VideoSource,
  signal?: AbortSignal,
): Promise<VideoSourceCheck> => {
  try {
    return await testVideoSource(buildStoredCheckPayload(source), signal)
  } catch (error) {
    if (signal?.aborted) {
      throw error
    }
    return failedCheck(getLegacyStatusMessage(error))
  }
}

export const saveVideoSource = async (
  payload: VideoSourceInput,
  existing?: Pick<VideoSource, 'name'>,
): Promise<void> => {
  if (existing) {
    await api.PUT('/cti/streaming/{descr}', {
      params: { path: { descr: existing.name } },
      body: payload,
    })
  } else {
    await api.POST('/cti/streaming', { body: payload })
  }
}

export const deleteVideoSource = async (name: string): Promise<void> => {
  await api.DELETE('/cti/streaming/{name}', { params: { path: { name } } })
}
