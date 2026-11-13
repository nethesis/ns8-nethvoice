//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { ApiError, isAuthenticationFailure } from '@/lib/api/errors'
import { CTI_API_URL } from '@/lib/config'
import { CTI_ADMIN_USERNAME } from '@/lib/dashboard/ctiClient'
import { useLoginStore } from '@/stores/login'

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const postCtiApi = async (path: string, body: unknown): Promise<unknown> => {
  const loginStore = useLoginStore()
  const credentials = loginStore.credentials
  const url = `${CTI_API_URL}${path}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(credentials ? { User: credentials.user, Secretkey: credentials.hash } : {}),
    },
    body: JSON.stringify(body),
  })
  const responseBody = await readBody(response)

  if (!response.ok) {
    if (
      credentials?.user === CTI_ADMIN_USERNAME &&
      isAuthenticationFailure(response.status, responseBody)
    ) {
      loginStore.handleAuthenticationFailure()
    }

    throw new ApiError({ status: response.status, method: 'POST', url, body: responseBody })
  }
  return responseBody
}
