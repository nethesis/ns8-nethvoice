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

const MAX_MESSAGE_LENGTH = 300
const MAX_DEPTH = 3
const MESSAGE_KEYS = ['message', 'error', 'errors', 'title', 'detail', 'status', 'result']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toPlainText = (text: string): string =>
  text
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const truncate = (text: string): string =>
  text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}…` : text

const readText = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return []
  }
  const text = toPlainText(value)

  return text && !/^(true|false)$/i.test(text) ? [text] : []
}

const readMessages = (value: unknown, depth: number): string[] => {
  if (depth > MAX_DEPTH) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => readMessages(item, depth + 1))
  }

  if (isRecord(value)) {
    for (const key of MESSAGE_KEYS) {
      const messages =
        key === 'errors' ? readFieldErrors(value[key], depth + 1) : readText(value[key])

      if (messages.length) {
        return messages
      }
    }
    return []
  }
  return readText(value)
}

const readFieldErrors = (value: unknown, depth: number): string[] => {
  if (!isRecord(value)) {
    return readMessages(value, depth)
  }
  const messages = readMessages(value, depth)

  if (messages.length) {
    return messages
  }
  return Object.entries(value).flatMap(([field, fieldValue]) => {
    const fieldMessages = readMessages(fieldValue, depth + 1)

    return fieldMessages.length ? [`${field}: ${fieldMessages.join(', ')}`] : []
  })
}

export const getApiErrorMessage = (body: unknown): string =>
  truncate([...new Set(readMessages(body, 0))].join('; '))

export const isAuthenticationFailure = (status: number, body: unknown): boolean => {
  if (status === 401) {
    return true
  }
  return (
    status === 403 &&
    /^Forbidden: (no credentials|invalid user|wrong secret key)$/.test(getApiErrorMessage(body))
  )
}
