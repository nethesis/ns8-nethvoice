//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { compareNatural } from '@/lib/common'

export const FXS_USERS_KEY = 'fxsUsers'

const NO_EXTENSION = 'none'

const UsersResponseSchema = v.array(
  v.object({
    username: v.string(),
    displayname: v.nullish(v.string(), ''),
    default_extension: v.nullish(
      v.pipe(v.union([v.string(), v.number()]), v.transform(String)),
      '',
    ),
  }),
)

export type FxsUser = {
  extension: string
  label: string
  description: string
}

export const parseFxsUsers = (raw: unknown): FxsUser[] =>
  v
    .parse(UsersResponseSchema, raw)
    .filter((user) => user.default_extension !== '' && user.default_extension !== NO_EXTENSION)
    .map((user) => ({
      extension: user.default_extension,
      label: `${user.username} (${user.default_extension})`,
      description: user.displayname.trim() === user.username ? '' : user.displayname.trim(),
    }))
    .sort((a, b) => compareNatural(a.label, b.label))

export const getFxsUsers = async (): Promise<FxsUser[]> => {
  const { data } = await api.GET('/users/{all}', { params: { path: { all: 'false' } } })
  return parseFxsUsers(data)
}

export const getFxsUserOptions = (users: FxsUser[], assignedExtensions: string[]): FxsUser[] => [
  ...users,
  ...assignedExtensions
    .filter(
      (extension, index) =>
        extension !== '' &&
        assignedExtensions.indexOf(extension) === index &&
        !users.some((user) => user.extension === extension),
    )
    .map((extension) => ({ extension, label: extension, description: '' })),
]
