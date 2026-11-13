//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const ADMIN_PHONE_STATUS_KEY = 'adminPhoneStatus'

export const ADMIN_PHONE_RELOAD_DELAY = 5000

export const ADMIN_PHONE_UA_TYPE = 'desktop'

export const ADMIN_PHONE_STATES = ['inactive', 'starting', 'registering', 'ready', 'error'] as const

export type AdminPhoneState = (typeof ADMIN_PHONE_STATES)[number]

export type AdminPhoneStatus = { enabled: boolean; extension: string | null }

export type AdminPhoneSession = {
  extension: string
  secret: string
  displayName: string
  sipHost: string
  sipPort: number
  ctiHost: string
  reloading: boolean
}

export type PhoneIslandSignal =
  'registered' | 'unregistered' | 'connection_lost' | 'call_started' | 'call_ended'

export type AdminPhoneSnapshot = { state: AdminPhoneState; inCall: boolean }

export const PHONE_ISLAND_EVENT_NAMES = [
  'phone-island-webrtc-registered',
  'phone-island-webrtc-unregistered',
  'phone-island-alert-set',
  'phone-island-call-started',
  'phone-island-outgoing-call-started',
  'phone-island-call-answered',
  'phone-island-call-ended',
] as const

export type PhoneIslandEventName = (typeof PHONE_ISLAND_EVENT_NAMES)[number]

export const PHONE_ISLAND_CALL_START_EVENT = 'phone-island-call-start'

const ExtensionSchema = v.pipe(v.string(), v.regex(/^[0-9]+$/))

const RequiredTextSchema = v.pipe(v.string(), v.trim(), v.minLength(1))

const AdminPhoneStatusSchema = v.object({
  enabled: v.boolean(),
  extension: v.nullable(ExtensionSchema),
})

const AdminPhoneSessionSchema = v.pipe(
  v.object({
    extension: ExtensionSchema,
    secret: RequiredTextSchema,
    display_name: v.string(),
    sip_host: RequiredTextSchema,
    sip_port: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)),
    cti_host: RequiredTextSchema,
    reloading: v.boolean(),
  }),
  v.transform((session): AdminPhoneSession => ({
    extension: session.extension,
    secret: session.secret,
    displayName: session.display_name,
    sipHost: session.sip_host,
    sipPort: session.sip_port,
    ctiHost: session.cti_host,
    reloading: session.reloading,
  })),
)

const AlertSchema = v.object({ type: v.string() })

export const parseAdminPhoneStatus = (raw: unknown): AdminPhoneStatus => {
  const status = v.parse(AdminPhoneStatusSchema, raw)
  return status.enabled ? status : { enabled: false, extension: null }
}

export const parseAdminPhoneSession = (raw: unknown): AdminPhoneSession =>
  v.parse(AdminPhoneSessionSchema, raw)

const toBase64 = (text: string): string =>
  btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join(''))

export const buildPhoneIslandConfig = (session: AdminPhoneSession): string =>
  toBase64(
    [
      session.ctiHost,
      '',
      '',
      session.extension,
      session.secret,
      session.sipHost,
      String(session.sipPort),
    ].join(':'),
  )

export const toPhoneIslandSignal = (name: string, detail: unknown): PhoneIslandSignal | null => {
  switch (name) {
    case 'phone-island-webrtc-registered':
      return 'registered'
    case 'phone-island-webrtc-unregistered':
      return 'unregistered'
    case 'phone-island-alert-set': {
      const alert = v.safeParse(AlertSchema, detail)
      return alert.success && alert.output.type === 'webrtc_down' ? 'connection_lost' : null
    }
    case 'phone-island-call-started':
    case 'phone-island-outgoing-call-started':
    case 'phone-island-call-answered':
      return 'call_started'
    case 'phone-island-call-ended':
      return 'call_ended'
    default:
      return null
  }
}

export const applyPhoneIslandSignal = (
  snapshot: AdminPhoneSnapshot,
  signal: PhoneIslandSignal,
): AdminPhoneSnapshot => {
  if (snapshot.state === 'inactive' || snapshot.state === 'starting') {
    return snapshot
  }

  switch (signal) {
    case 'registered':
      return { state: 'ready', inCall: snapshot.inCall }
    case 'unregistered':
      return { state: 'registering', inCall: false }
    case 'connection_lost':
      return { state: 'error', inCall: false }
    case 'call_started':
      return snapshot.state === 'ready' ? { state: 'ready', inCall: true } : snapshot
    case 'call_ended':
      return { state: snapshot.state, inCall: false }
  }
}

export const isCallableNumber = (value: string): boolean => /^[0-9*#+]+$/.test(value.trim())

export const isServiceDestination = (
  destination: string,
  serviceExtension: string | null,
): boolean =>
  serviceExtension !== null &&
  (destination.split(',')[1] ?? '').replace(/^vm[a-z]/, '') === serviceExtension

export const withoutServiceExtension = <TItem>(
  items: TItem[],
  extensionOf: (item: TItem) => string,
  serviceExtension: string | null,
): TItem[] =>
  serviceExtension ? items.filter((item) => extensionOf(item) !== serviceExtension) : items

export const getAdminPhoneStatus = async (signal?: AbortSignal): Promise<AdminPhoneStatus> => {
  const { data } = await api.GET('/adminphone', { signal })
  return parseAdminPhoneStatus(data)
}

export const postAdminPhoneSession = async (): Promise<AdminPhoneSession> => {
  const { data } = await api.POST('/adminphone/session', { body: {} })
  return parseAdminPhoneSession(data)
}

export const postAdminPhoneRotate = async (): Promise<void> => {
  await api.POST('/adminphone/rotate')
}

let serviceExtension: Promise<string | null> | null = null

export const getServiceExtension = (): Promise<string | null> => {
  serviceExtension ??= getAdminPhoneStatus()
    .then((status) => status.extension)
    .catch(() => null)
  return serviceExtension
}

export const rememberServiceExtension = (extension: string | null) => {
  serviceExtension = Promise.resolve(extension)
}

export const forgetServiceExtension = () => {
  serviceExtension = null
}
