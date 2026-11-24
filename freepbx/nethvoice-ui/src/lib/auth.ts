//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { SECTIONS, SUPERADMIN, type Permission } from '@/lib/permissions/permissions'

export const LoginSchema = v.object({
  username: v.pipe(v.string(), v.trim(), v.nonEmpty('login.username_required')),
  password: v.pipe(v.string(), v.nonEmpty('login.password_required')),
})

export type LoginForm = v.InferOutput<typeof LoginSchema>

const TestAuthResponseSchema = v.object({
  result: v.pipe(v.string(), v.nonEmpty()),
})

export const postTestAuth = async (username: string, password: string): Promise<string> => {
  const { data } = await api.POST('/testauth', { body: { username, password } })

  return v.parse(TestAuthResponseSchema, data).result
}

export const SIGN_IN_FAILURES = [
  'invalid_credentials',
  'password_expired',
  'account_conflict',
  'too_many_attempts',
  'domain_unavailable',
  'storage_unavailable',
  'generic',
] as const

export type SignInFailure = (typeof SIGN_IN_FAILURES)[number]

export type SignInResult = {
  user: string
  secretkey: string
  permissions: Permission[]
  source: 'local' | 'domain'
}

export class SignInError extends Error {
  readonly failure: SignInFailure
  readonly retryAfter: number | null

  constructor(failure: SignInFailure, retryAfter: number | null = null, cause?: unknown) {
    super(failure, { cause })
    this.name = 'SignInError'
    this.failure = failure
    this.retryAfter = retryAfter
  }
}

const PERMISSIONS: readonly string[] = [SUPERADMIN, ...SECTIONS]

const SignInResponseSchema = v.object({
  user: v.pipe(v.string(), v.nonEmpty()),
  secretkey: v.pipe(v.string(), v.nonEmpty()),
  permissions: v.array(v.string()),
  source: v.picklist(['local', 'domain']),
})

export const parseSignInResult = (raw: unknown): SignInResult => {
  const result = v.parse(SignInResponseSchema, raw)

  return {
    ...result,
    permissions: result.permissions.filter((permission): permission is Permission =>
      PERMISSIONS.includes(permission),
    ),
  }
}

export const parseRetryAfter = (value: string | null, now = Date.now()): number | null => {
  if (!value?.trim()) {
    return null
  }
  if (/^\d+$/.test(value.trim())) {
    return Number(value.trim())
  }
  const date = Date.parse(value)

  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - now) / 1000))
}

const readCode = (body: unknown): unknown =>
  typeof body === 'object' && body !== null && 'code' in body
    ? (body as { code: unknown }).code
    : null

export const toSignInError = (error: unknown, retryAfter: string | null): SignInError => {
  if (!isApiError(error)) {
    return new SignInError('generic', null, error)
  }
  const code = readCode(error.body)

  if (error.status === 401) {
    return new SignInError('invalid_credentials', null, error)
  }
  if (error.status === 403 && (code === 'password_expired' || code === 'account_conflict')) {
    return new SignInError(code, null, error)
  }
  if (error.status === 429) {
    return new SignInError('too_many_attempts', parseRetryAfter(retryAfter), error)
  }
  if (error.status === 503) {
    return new SignInError('domain_unavailable', null, error)
  }
  return new SignInError('generic', null, error)
}

export const postSignIn = async (username: string, password: string): Promise<SignInResult> => {
  let retryAfter: string | null = null

  try {
    const { data } = await api.POST('/signin', {
      body: { username, password },
      fetch: async (request) => {
        const response = await globalThis.fetch(request)
        retryAfter = response.headers.get('Retry-After')
        return response
      },
    })
    return parseSignInResult(data)
  } catch (error) {
    throw toSignInError(error, retryAfter)
  }
}
