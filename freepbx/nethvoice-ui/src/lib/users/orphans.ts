//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { compareNatural } from '@/lib/common'
import { SOFTWARE_DEVICE_TYPES, type SoftwareDeviceType } from '@/lib/users/users'

export const ORPHAN_EXTENSIONS_KEY = 'orphanExtensions'

export type OrphanDevice = {
  extension: string
  type: string
  mac: string
}

export type OrphanExtension = {
  username: string
  displayName: string
  extension: string
  devices: OrphanDevice[]
  removedAt: Date | null
}

const OrphanExtensionsSchema = v.array(
  v.object({
    username: v.string(),
    displayname: v.optional(v.nullable(v.string()), ''),
    extension: v.pipe(v.union([v.string(), v.number()]), v.transform(String)),
    devices: v.optional(
      v.array(
        v.object({
          extension: v.pipe(v.union([v.string(), v.number()]), v.transform(String)),
          type: v.optional(v.nullable(v.string()), ''),
          mac: v.optional(v.nullable(v.string()), null),
        }),
      ),
      [],
    ),
    removed_at: v.optional(v.nullable(v.string()), null),
  }),
)

const toDate = (value: string | null): Date | null => {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const parseOrphanExtensions = (raw: unknown): OrphanExtension[] =>
  v
    .parse(OrphanExtensionsSchema, raw)
    .map((orphan) => ({
      username: orphan.username,
      displayName: orphan.displayname || orphan.username,
      extension: orphan.extension,
      devices: orphan.devices.map((device) => ({
        extension: device.extension,
        type: device.type ?? '',
        mac: device.mac ?? '',
      })),
      removedAt: toDate(orphan.removed_at),
    }))
    .sort((a, b) => compareNatural(a.extension, b.extension))

export const getOrphanExtensions = async (): Promise<OrphanExtension[]> => {
  const { data } = await api.GET('/mainextensions/orphans')
  return parseOrphanExtensions(data)
}

export const releaseOrphanExtensions = async (extensions: string[]): Promise<void> => {
  await api.POST('/mainextensions/orphans/release', {
    body: { extensions },
    parseAs: 'text',
  })
}

export const getOrphanSoftwareDevices = (orphan: OrphanExtension): SoftwareDeviceType[] =>
  SOFTWARE_DEVICE_TYPES.filter((type) => orphan.devices.some((device) => device.type === type))

export const countOrphanPhones = (orphan: OrphanExtension): number =>
  orphan.devices.filter(
    (device) => device.type === 'physical' || device.type === 'temporaryphysical',
  ).length
