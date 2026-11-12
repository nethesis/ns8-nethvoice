//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { compareNatural } from '@/lib/common'
import { tancredi } from './tancrediClient'

export const PHONE_FILES_KEY = 'phoneFiles'

export type PhoneFileType = 'backgrounds' | 'firmware' | 'ringtones' | 'screensavers'

export type PhoneFile = {
  name: string
  size: number
}

const FilesResponseSchema = v.array(
  v.object({
    name: v.string(),
    size: v.nullish(v.number(), 0),
  }),
)

export const isValidPhoneFileName = (name: string): boolean => /^[a-zA-Z0-9\-_.()]+$/.test(name)

export const parsePhoneFiles = (raw: unknown): PhoneFile[] =>
  v
    .parse(FilesResponseSchema, raw ?? [])
    .map((file) => ({ name: file.name, size: file.size }))
    .sort((a, b) => compareNatural(a.name, b.name))

export const getPhoneFiles = async (type: PhoneFileType): Promise<PhoneFile[]> =>
  parsePhoneFiles(await tancredi.get(`/${type}`))

export const uploadPhoneFile = async (type: PhoneFileType, file: File): Promise<void> => {
  await tancredi.upload(`/${type}`, file)
}
