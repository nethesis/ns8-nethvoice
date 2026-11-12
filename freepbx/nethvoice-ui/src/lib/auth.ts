//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

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
