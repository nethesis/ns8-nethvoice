//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { TANCREDI_API_URL } from '@/lib/config'
import { ApiError } from '@/lib/api/errors'
import { useLoginStore } from '@/stores/login'

export type TancrediQuery = Record<string, string | number | boolean | undefined>

type TancrediRequestOptions = {
  query?: TancrediQuery
  body?: unknown
  formData?: FormData
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isTancrediAuthenticationFailure = (status: number, body: unknown): boolean => {
  if (status === 401) {
    return true
  }
  return (
    status === 403 &&
    isRecord(body) &&
    typeof body.type === 'string' &&
    /\/problems\/?#forbidden$/.test(body.type)
  )
}

export const getTancrediProblemType = (body: unknown): string => {
  if (!isRecord(body) || typeof body.type !== 'string') {
    return ''
  }
  return body.type.split('#')[1] ?? ''
}

export const buildTancrediUrl = (path: string, query: TancrediQuery = {}): string => {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value))
    }
  }
  const search = params.toString()

  return `${TANCREDI_API_URL}${path}${search ? `?${search}` : ''}`
}

const readBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204 || response.status === 205) {
    return null
  }
  const text = await response.text()

  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const request = async (
  method: string,
  path: string,
  options: TancrediRequestOptions = {},
): Promise<unknown> => {
  const loginStore = useLoginStore()
  const headers = new Headers({ Accept: 'application/json' })
  const credentials = loginStore.credentials

  if (credentials) {
    headers.set('User', credentials.user)
    headers.set('Secretkey', credentials.hash)
  }
  let body: BodyInit | undefined

  if (options.formData) {
    body = options.formData
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }
  const url = buildTancrediUrl(path, options.query)
  const response = await globalThis.fetch(url, { method, headers, body })
  const payload = await readBody(response)

  if (!response.ok) {
    if (isTancrediAuthenticationFailure(response.status, payload)) {
      loginStore.handleAuthenticationFailure()
    }

    throw new ApiError({
      status: response.status,
      method,
      url: `${TANCREDI_API_URL}${path}`,
      body: payload,
    })
  }
  return payload
}

export const tancredi = {
  get: (path: string, query?: TancrediQuery) => request('GET', path, { query }),
  post: (path: string, body: unknown) => request('POST', path, { body }),
  patch: (path: string, body: unknown) => request('PATCH', path, { body }),
  delete: (path: string) => request('DELETE', path),
  upload: (path: string, file: File) => {
    const formData = new FormData()
    formData.append('0', file)
    return request('POST', path, { formData })
  },
}
