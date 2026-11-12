//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { truncateText } from './redact.mjs'

export class UpstreamError extends Error {
  constructor(status, method, path, detail = '') {
    super(`${method} ${path} failed with status ${status}${detail ? `: ${detail}` : ''}`)
    this.name = 'UpstreamError'
    this.status = status
  }
}

export const readErrorDetail = async (response) => {
  try {
    const text = await response.text()

    try {
      const body = JSON.parse(text)
      const message = body?.message ?? body?.error ?? ''
      return typeof message === 'string' ? truncateText(message, 200) : ''
    } catch {
      return truncateText(text.trim(), 200)
    }
  } catch {
    return ''
  }
}

export const readJson = async (response) => {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new UpstreamError(response.status, 'GET', new URL(response.url).pathname, 'not JSON')
  }
}
