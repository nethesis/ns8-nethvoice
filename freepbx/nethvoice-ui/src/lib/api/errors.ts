//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export type ApiErrorDetails = {
  status: number
  method: string
  url: string
  body: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly method: string
  readonly url: string
  readonly body: unknown

  constructor(details: ApiErrorDetails) {
    super(getApiErrorMessage(details.body) || `Request failed with status code ${details.status}`)
    this.name = 'ApiError'
    this.status = details.status
    this.method = details.method
    this.url = details.url
    this.body = details.body
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getApiErrorMessage = (body: unknown): string => {
  if (typeof body === 'string') {
    return body.trim()
  }

  if (isRecord(body)) {
    for (const key of ['message', 'error', 'title', 'detail']) {
      const value = body[key]

      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }
  return ''
}

export const isAuthenticationFailure = (status: number, body: unknown): boolean => {
  if (status === 401) {
    return true
  }
  return (
    status === 403 &&
    /^Forbidden: (no credentials|invalid user|wrong secret key)$/.test(getApiErrorMessage(body))
  )
}
