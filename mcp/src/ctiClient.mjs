//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { abortable, readErrorDetail, readJson, send, UpstreamError } from './httpError.mjs'

const LOGIN_PATH = '/api/login'

export class CtiClient {
  #baseUrl
  #fetch
  #username
  #password
  #token
  #timeoutMs
  #canLogin
  #pendingLogin

  constructor({ baseUrl, username = '', password = '', token = '', timeoutMs = 15000, fetch }) {
    this.#baseUrl = baseUrl
    this.#fetch = fetch ?? globalThis.fetch
    this.#username = username
    this.#password = password
    this.#token = token
    this.#timeoutMs = timeoutMs
    this.#canLogin = Boolean(username && password)
  }

  async #login() {
    const response = await send(
      this.#fetch,
      `${this.#baseUrl}${LOGIN_PATH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: this.#username, password: this.#password }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      },
      'POST',
      LOGIN_PATH,
    )

    if (!response.ok) {
      throw new UpstreamError(response.status, 'POST', LOGIN_PATH, await readErrorDetail(response))
    }
    const body = await readJson(response, 'POST', LOGIN_PATH)

    if (!body || typeof body.token !== 'string' || !body.token) {
      throw new UpstreamError(response.status, 'POST', LOGIN_PATH, 'no token in the response')
    }
    this.#token = body.token
    return body.token
  }

  #ensureToken() {
    if (this.#token) {
      return Promise.resolve(this.#token)
    }

    if (!this.#pendingLogin) {
      this.#pendingLogin = this.#login().finally(() => {
        this.#pendingLogin = undefined
      })
    }
    return this.#pendingLogin
  }

  async #request(method, path, body, signal, allowRetry) {
    const fullPath = `/api${path}`

    if (!this.#token && !this.#canLogin) {
      throw new UpstreamError(401, method, fullPath, 'no credentials')
    }
    const token = await abortable(this.#ensureToken(), signal, 'POST', LOGIN_PATH)

    const response = await send(
      this.#fetch,
      `${this.#baseUrl}${fullPath}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      },
      method,
      fullPath,
    )

    if (response.status === 401 && allowRetry && this.#canLogin) {
      if (this.#token === token) {
        this.#token = ''
      }
      return this.#request(method, path, body, signal, false)
    }

    if (!response.ok) {
      throw new UpstreamError(response.status, method, fullPath, await readErrorDetail(response))
    }
    return readJson(response, method, fullPath)
  }

  get(path, { signal } = {}) {
    return this.#request('GET', path, undefined, signal ?? AbortSignal.timeout(this.#timeoutMs), true)
  }

  post(path, body, { signal } = {}) {
    return this.#request('POST', path, body, signal ?? AbortSignal.timeout(this.#timeoutMs), true)
  }
}
