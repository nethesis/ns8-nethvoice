//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { compareNatural, matchesText } from '@/lib/common'
import {
  getPhysicalPhones,
  hasMainExtension,
  MAX_DEVICES_PER_USER,
  type User,
} from '@/lib/users/users'
import { postExtensionEncryption, type PhoneEncryption } from './encryption'
import { findDuplicatedMacs, formatMac, isUnicastMac, isValidMac, toTancrediMac } from './mac'
import { getModelBrand, type PhoneModel } from './models'
import type { PhoneRegistrations } from './registration'
import { getTancrediProblemType, tancredi } from './tancrediClient'

export const PHONES_KEY = 'phones'

export const UNASSIGNED_FILTER_ID = '__unassigned__'

export const MAX_NEW_PHONES = 50

export const PHONE_STATUSES = ['registered', 'unregistered'] as const

export type PhoneStatus = (typeof PHONE_STATUSES)[number] | 'unknown'

const WEB_USER = 'admin'

export type TancrediPhone = {
  mac: string
  model: string
  vendor: string
}

export type PhoneUser = {
  username: string
  displayName: string
  mainExtension: string
}

export type Phone = {
  mac: string
  model: string
  modelLabel: string
  vendor: string
  user: PhoneUser | null
  extension: string
  encrypted: boolean
}

export type PhoneFilters = {
  text: string
  models: string[]
  users: string[]
  statuses?: PhoneStatus[]
}

export type NewPhoneRow = {
  mac: string
  model: string
  mainExtension: string
}

export type NewPhoneRowIssue =
  | 'phones.inventory.mac_invalid'
  | 'phones.inventory.mac_not_unicast'
  | 'phones.inventory.mac_already_exists'
  | 'phones.inventory.mac_duplicated'
  | 'phones.inventory.model_required'

export type NewPhoneRowIssues = {
  mac?: NewPhoneRowIssue
  model?: NewPhoneRowIssue
}

export type PhoneAssignmentOptions = {
  webPassword: string
  encrypted: boolean
}

export type AddPhoneResult = {
  mac: string
  rpsFailed: boolean
}

export type PhoneChanges = {
  model: string
  mainExtension: string
  encrypted: boolean
}

export type ProvisioningUrls = {
  firstAccess: string
  permanent: string
}

export type ProvisioningResult = {
  started: number
  failed: number
}

export class PhoneAssignmentError extends Error {
  readonly reason: unknown

  constructor(reason: unknown) {
    super(reason instanceof Error ? reason.message : 'Phone assignment failed')
    this.name = 'PhoneAssignmentError'
    this.reason = reason
  }
}

export class PhoneReassignmentError extends Error {
  readonly reason: unknown

  constructor(reason: unknown) {
    super(reason instanceof Error ? reason.message : 'Phone reassignment incomplete')
    this.name = 'PhoneReassignmentError'
    this.reason = reason
  }
}

export class MissingWebPasswordError extends Error {
  constructor() {
    super('The default settings of the phones are not available')
    this.name = 'MissingWebPasswordError'
  }
}

const TancrediPhoneSchema = v.object({
  mac: v.string(),
  model: v.nullish(v.string(), ''),
  display_name: v.nullish(v.string(), ''),
})

const TancrediPhonesResponseSchema = v.array(TancrediPhoneSchema)

const TancrediPhoneDetailSchema = v.object({
  mac: v.string(),
  provisioning_url1: v.nullish(v.string(), ''),
  provisioning_url2: v.nullish(v.string(), ''),
})

const PhysicalExtensionResponseSchema = v.object({
  extension: v.pipe(v.union([v.string(), v.number()]), v.transform(String)),
})

export const parseTancrediPhones = (raw: unknown): TancrediPhone[] =>
  v.parse(TancrediPhonesResponseSchema, raw).map((phone) => ({
    mac: toTancrediMac(phone.mac),
    model: phone.model,
    vendor: phone.display_name,
  }))

export const parseProvisioningUrls = (raw: unknown): ProvisioningUrls => {
  const phone = v.parse(TancrediPhoneDetailSchema, raw)
  return { firstAccess: phone.provisioning_url1, permanent: phone.provisioning_url2 }
}

export const getAssignableUsers = (users: User[]): User[] =>
  users.filter(hasMainExtension).sort((a, b) => compareNatural(a.displayName, b.displayName))

export const getUserLabel = (user: Pick<User, 'displayName' | 'username'>): string =>
  `${user.displayName} (${user.username})`

export const isUserAtDeviceLimit = (user: Pick<User, 'devices'>): boolean =>
  user.devices.length >= MAX_DEVICES_PER_USER

export const getPhoneStatus = (
  phone: Pick<Phone, 'extension'>,
  registrations: PhoneRegistrations | undefined,
): PhoneStatus => {
  if (!phone.extension) {
    return 'unregistered'
  }

  if (!registrations) {
    return 'unknown'
  }
  return registrations[phone.extension]?.registered ? 'registered' : 'unregistered'
}

export const buildPhones = (
  tancrediPhones: TancrediPhone[],
  models: PhoneModel[],
  users: User[],
  encryption: PhoneEncryption,
): Phone[] => {
  const modelLabels = new Map(models.map((model) => [model.name, model.displayName]))
  const assignments = new Map<string, { user: PhoneUser; extension: string }>()

  for (const user of users) {
    for (const device of getPhysicalPhones(user)) {
      if (!isValidMac(device.mac) || !device.extension) {
        continue
      }
      const mac = toTancrediMac(device.mac)

      if (!assignments.has(mac)) {
        assignments.set(mac, {
          user: {
            username: user.username,
            displayName: user.displayName,
            mainExtension: user.mainExtension,
          },
          extension: device.extension,
        })
      }
    }
  }

  return tancrediPhones
    .map((phone) => {
      const assignment = assignments.get(phone.mac)

      return {
        mac: phone.mac,
        model: phone.model,
        modelLabel: modelLabels.get(phone.model) ?? phone.model,
        vendor: phone.vendor || getModelBrand(phone.model),
        user: assignment?.user ?? null,
        extension: assignment?.extension ?? '',
        encrypted: assignment ? encryption[assignment.extension] === true : false,
      }
    })
    .sort((a, b) => compareNatural(a.mac, b.mac))
}

export const filterPhones = (
  phones: Phone[],
  filters: PhoneFilters,
  registrations?: PhoneRegistrations,
): Phone[] =>
  phones.filter((phone) => {
    if (filters.models.length > 0 && !filters.models.includes(phone.model)) {
      return false
    }

    if (
      filters.statuses &&
      filters.statuses.length > 0 &&
      !filters.statuses.includes(getPhoneStatus(phone, registrations))
    ) {
      return false
    }

    if (
      filters.users.length > 0 &&
      !filters.users.includes(phone.user?.username ?? UNASSIGNED_FILTER_ID)
    ) {
      return false
    }
    return matchesText(
      filters.text,
      phone.mac,
      formatMac(phone.mac),
      phone.mac.replace(/-/g, ''),
      phone.modelLabel,
      phone.user?.displayName,
      phone.user?.username,
      phone.extension,
    )
  })

export const validateNewPhoneRows = (
  rows: NewPhoneRow[],
  existingMacs: string[],
): NewPhoneRowIssues[] => {
  const duplicated = findDuplicatedMacs(rows.map((row) => row.mac))

  return rows.map((row) => {
    const issues: NewPhoneRowIssues = {}

    if (!isValidMac(row.mac)) {
      issues.mac = 'phones.inventory.mac_invalid'
    } else if (!isUnicastMac(row.mac)) {
      issues.mac = 'phones.inventory.mac_not_unicast'
    } else if (existingMacs.includes(toTancrediMac(row.mac))) {
      issues.mac = 'phones.inventory.mac_already_exists'
    } else if (duplicated.includes(toTancrediMac(row.mac))) {
      issues.mac = 'phones.inventory.mac_duplicated'
    }

    if (!row.model) {
      issues.model = 'phones.inventory.model_required'
    }
    return issues
  })
}

export const isPhoneAlreadyRegistered = (error: unknown): boolean =>
  isApiError(error) && error.status === 409 && getTancrediProblemType(error.body) === 'phone-exists'

const phonePath = (mac: string) => `/phones/${encodeURIComponent(mac)}`

export const getTancrediPhones = async (): Promise<TancrediPhone[]> =>
  parseTancrediPhones(await tancredi.get('/phones'))

export const getProvisioningUrls = async (mac: string): Promise<ProvisioningUrls> =>
  parseProvisioningUrls(await tancredi.get(phonePath(mac)))

export const getProvisioningUrl = async (mac: string): Promise<string> => {
  const urls = await getProvisioningUrls(mac)
  return urls.firstAccess || urls.permanent
}

const postPhysicalExtension = async (body: {
  mac: string
  model: string
  mainextension?: string
  clear_temporary?: boolean
  webPassword: string
}): Promise<string> => {
  const { webPassword, ...payload } = body
  const { data } = await api.POST('/physicalextensions', {
    body: { ...payload, line: null, web_user: WEB_USER, web_password: webPassword },
  })

  if (data === undefined || data === null) {
    return ''
  }
  return v.parse(PhysicalExtensionResponseSchema, data).extension
}

const assertWebPassword = (webPassword: string) => {
  if (!webPassword) {
    throw new MissingWebPasswordError()
  }
}

const deletePhysicalExtension = async (id: string): Promise<void> => {
  await api.DELETE('/physicalextensions/{id}', { params: { path: { id } } })
}

const registerToRemoteProvisioning = async (mac: string): Promise<boolean> => {
  try {
    const { firstAccess } = await getProvisioningUrls(mac)

    if (firstAccess) {
      await api.POST('/phones/rps/{mac}', {
        params: { path: { mac } },
        body: { url: firstAccess },
      })
    }
    return true
  } catch {
    return false
  }
}

const assignPhone = async (
  mac: string,
  model: string,
  mainExtension: string,
  options: PhoneAssignmentOptions,
): Promise<string> => {
  const extension = await postPhysicalExtension({
    mainextension: mainExtension,
    mac,
    model,
    clear_temporary: true,
    webPassword: options.webPassword,
  })

  if (extension) {
    await postExtensionEncryption(extension, options.encrypted)
  }
  return extension
}

export const addPhone = async (
  row: NewPhoneRow,
  vendor: string,
  options: PhoneAssignmentOptions,
): Promise<AddPhoneResult> => {
  const mac = toTancrediMac(row.mac)

  assertWebPassword(options.webPassword)
  await tancredi.post('/phones', { mac, model: row.model, display_name: vendor })

  try {
    await postPhysicalExtension({ mac, model: row.model, webPassword: options.webPassword })
  } catch (error) {
    await tancredi.delete(phonePath(mac)).catch(() => undefined)
    throw error
  }
  const registered = await registerToRemoteProvisioning(mac)

  if (row.mainExtension) {
    try {
      await assignPhone(mac, row.model, row.mainExtension, options)
    } catch (error) {
      throw new PhoneAssignmentError(error)
    }
  }
  return { mac, rpsFailed: !registered }
}

const reassignPhone = async (
  phone: Phone,
  changes: PhoneChanges,
  webPassword: string,
): Promise<void> => {
  const extension = changes.mainExtension
    ? await postPhysicalExtension({
        mainextension: changes.mainExtension,
        mac: phone.mac,
        model: changes.model,
        clear_temporary: true,
        webPassword,
      })
    : ''
  const failures: unknown[] = []

  if (extension) {
    await postExtensionEncryption(extension, changes.encrypted).catch((error: unknown) => {
      failures.push(error)
    })
  }

  if (phone.extension) {
    await deletePhysicalExtension(phone.extension).catch((error: unknown) => {
      failures.push(error)
    })
  }

  if (failures.length > 0) {
    throw changes.mainExtension ? new PhoneReassignmentError(failures[0]) : failures[0]
  }
}

export const updatePhone = async (
  phone: Phone,
  changes: PhoneChanges,
  webPassword: string,
): Promise<void> => {
  const userChanged = changes.mainExtension !== (phone.user?.mainExtension ?? '')

  if (userChanged && changes.mainExtension) {
    assertWebPassword(webPassword)
  }

  if (changes.model !== phone.model) {
    await tancredi.patch(phonePath(phone.mac), { model: changes.model })

    try {
      await api.PATCH('/physicalextensions/{mac}', {
        params: { path: { mac: phone.mac } },
        body: { model: changes.model },
      })
    } catch (error) {
      await tancredi.patch(phonePath(phone.mac), { model: phone.model }).catch(() => undefined)
      throw error
    }
  }

  if (userChanged) {
    await reassignPhone(phone, changes, webPassword)
    return
  }

  if (phone.extension && changes.encrypted !== phone.encrypted) {
    await postExtensionEncryption(phone.extension, changes.encrypted)
  }
}

export const deletePhone = async (phone: Phone): Promise<void> => {
  await deletePhysicalExtension(phone.mac)

  try {
    await tancredi.delete(phonePath(phone.mac))
  } catch (error) {
    if (!isApiError(error) || error.status !== 404) {
      throw error
    }
  }
}

export const runProvisioning = async (phones: Phone[]): Promise<ProvisioningResult> => {
  const results = await Promise.allSettled(
    phones
      .filter((phone) => phone.extension !== '')
      .map((phone) => api.POST('/phones/reconfigure', { body: { extension: phone.extension } })),
  )
  const started = results.filter((result) => result.status === 'fulfilled').length

  return { started, failed: results.length - started }
}
