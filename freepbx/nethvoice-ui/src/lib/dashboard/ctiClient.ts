//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { ApiError, isAuthenticationFailure } from '@/lib/api/errors'
import { CTI_API_URL } from '@/lib/config'
import { useLoginStore } from '@/stores/login'

export const CTI_ADMIN_USERNAME = 'admin'

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text()

  if (!text.trim()) {
    return undefined
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const adminApiGet = async <TSchema extends v.GenericSchema>(
  url: string,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> => {
  const loginStore = useLoginStore()
  const credentials = loginStore.credentials
  const headers = new Headers({ Accept: 'application/json' })

  if (credentials) {
    headers.set('User', credentials.user)
    headers.set('Secretkey', credentials.hash)
  }

  const response = await fetch(url, { headers })
  const body = await readBody(response)

  if (!response.ok) {
    if (
      credentials?.user === CTI_ADMIN_USERNAME &&
      isAuthenticationFailure(response.status, body)
    ) {
      loginStore.handleAuthenticationFailure()
    }

    throw new ApiError({ status: response.status, method: 'GET', url, body })
  }
  return v.parse(schema, body)
}

export const ctiGet = <TSchema extends v.GenericSchema>(
  path: string,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> => adminApiGet(`${CTI_API_URL}${path}`, schema)
