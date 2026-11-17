//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from 'node:crypto'
import { abortable, readErrorDetail, readJson, send, UpstreamError } from './httpError.mjs'

const AUTH_PATH = '/freepbx/rest/testauth'
const WRONG_SECRET_KEY = /wrong secret key/i

const sha1 = (text) => createHash('sha1').update(text, 'utf8').digest('hex')

export const buildSecretKey = (username, password, sharedSecret) => sha1(`${username}${sha1(password)}${sharedSecret}`)

export class PbxClient {
  #baseUrl
  #fetch
  #username
  #password
  #secretKey = ''
  #pendingAuthentication
  #timeoutMs

  constructor({ baseUrl, username, password, timeoutMs = 15000, fetch }) {
    this.#baseUrl = baseUrl
    this.#fetch = fetch ?? globalThis.fetch
    this.#username = username
    this.#password = password
    this.#timeoutMs = timeoutMs
  }

  async #authenticate() {
    const response = await send(
      this.#fetch,
      `${this.#baseUrl}${AUTH_PATH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: this.#username, password: this.#password }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      },
      'POST',
      AUTH_PATH,
    )

    if (!response.ok) {
      throw new UpstreamError(response.status, 'POST', AUTH_PATH, await readErrorDetail(response))
    }
    const body = await readJson(response, 'POST', AUTH_PATH)

    if (!body || typeof body.result !== 'string' || !body.result) {
      throw new UpstreamError(response.status, 'POST', AUTH_PATH, 'no shared secret in the response')
    }
    this.#secretKey = buildSecretKey(this.#username, this.#password, body.result)
    return this.#secretKey
  }

  #ensureSecretKey() {
    if (this.#secretKey) {
      return Promise.resolve(this.#secretKey)
    }

    if (!this.#pendingAuthentication) {
      this.#pendingAuthentication = this.#authenticate().finally(() => {
        this.#pendingAuthentication = undefined
      })
    }
    return this.#pendingAuthentication
  }

  async #request(path, signal, allowRetry) {
    const secretKey = await abortable(this.#ensureSecretKey(), signal, 'POST', AUTH_PATH)
    const fullPath = `/freepbx/rest${path}`
    const response = await send(
      this.#fetch,
      `${this.#baseUrl}${fullPath}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json', User: this.#username, Secretkey: secretKey },
        signal,
      },
      'GET',
      fullPath,
    )

    if (!response.ok) {
      const detail = await readErrorDetail(response)

      if (response.status === 403 && allowRetry && WRONG_SECRET_KEY.test(detail)) {
        if (this.#secretKey === secretKey) {
          this.#secretKey = ''
        }
        return this.#request(path, signal, false)
      }
      throw new UpstreamError(response.status, 'GET', fullPath, detail)
    }
    return readJson(response, 'GET', fullPath)
  }

  get(path, { signal } = {}) {
    return this.#request(path, signal ?? AbortSignal.timeout(this.#timeoutMs), true)
  }
}
