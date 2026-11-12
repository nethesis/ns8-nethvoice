//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { compareNatural, matchesText } from '@/lib/common'
import { getPhysicalPhones, hasMainExtension, type User } from '@/lib/users/users'
import { postExtensionEncryption, type PhoneEncryption } from './encryption'
import { findDuplicatedMacs, formatMac, isValidMac, toTancrediMac } from './mac'
import { getModelBrand, type PhoneModel } from './models'
import { getTancrediProblemType, tancredi } from './tancrediClient'

export const PHONES_KEY = 'phones'

export const UNASSIGNED_FILTER_ID = '__unassigned__'

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
}

export type NewPhoneRow = {
  mac: string
  model: string
  mainExtension: string
}

export type NewPhoneRowIssue =
  | 'phones.inventory.mac_invalid'
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

export const filterPhones = (phones: Phone[], filters: PhoneFilters): Phone[] =>
  phones.filter((phone) => {
    if (filters.models.length > 0 && !filters.models.includes(phone.model)) {
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

export const updatePhone = async (
  phone: Phone,
  changes: PhoneChanges,
  webPassword: string,
): Promise<void> => {
  if (changes.model !== phone.model) {
    await tancredi.patch(phonePath(phone.mac), { model: changes.model })
    await api.PATCH('/physicalextensions/{mac}', {
      params: { path: { mac: phone.mac } },
      body: { model: changes.model },
    })
  }

  if (changes.mainExtension !== (phone.user?.mainExtension ?? '')) {
    if (phone.extension) {
      await deletePhysicalExtension(phone.extension)
    }

    if (changes.mainExtension) {
      await assignPhone(phone.mac, changes.model, changes.mainExtension, {
        webPassword,
        encrypted: changes.encrypted,
      })
    }
    return
  }

  if (phone.extension && changes.encrypted !== phone.encrypted) {
    await postExtensionEncryption(phone.extension, changes.encrypted)
  }
}

export const deletePhone = async (phone: Phone): Promise<void> => {
  try {
    await tancredi.delete(phonePath(phone.mac))
  } catch (error) {
    if (!isApiError(error) || error.status !== 404) {
      throw error
    }
  }
  await deletePhysicalExtension(phone.mac)
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
