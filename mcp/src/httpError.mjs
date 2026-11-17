//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { truncateText } from './redact.mjs'

export class UpstreamError extends Error {
  constructor(status, method, path, detail = '') {
    super(`${method} ${path} failed with status ${status}${detail ? `: ${detail}` : ''}`)
    this.name = 'UpstreamError'
    this.status = status
    this.method = method
    this.path = path
    this.detail = detail
  }
}

export class NetworkError extends Error {
  constructor(method, path, code) {
    super(`${method} ${path} failed: ${code}`)
    this.name = 'NetworkError'
    this.method = method
    this.path = path
    this.code = code
  }
}

export const describeCause = (error) => {
  if (error?.name === 'TimeoutError') {
    return 'timeout'
  }

  if (error?.name === 'AbortError') {
    return 'aborted'
  }
  const code = error?.cause?.code ?? error?.code

  return typeof code === 'string' && code ? code : 'network error'
}

export const send = async (fetchImpl, url, init, method, path) => {
  try {
    return await fetchImpl(url, init)
  } catch (error) {
    throw new NetworkError(method, path, describeCause(error))
  }
}

export const abortable = (promise, signal, method, path) => {
  if (!signal) {
    return promise
  }

  if (signal.aborted) {
    return Promise.reject(new NetworkError(method, path, describeCause(signal.reason)))
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new NetworkError(method, path, describeCause(signal.reason)))

    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
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

export const readJson = async (response, method, path) => {
  let text

  try {
    text = await response.text()
  } catch (error) {
    throw new NetworkError(method, path, describeCause(error))
  }

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new UpstreamError(response.status, method, path, 'not JSON')
  }
}
