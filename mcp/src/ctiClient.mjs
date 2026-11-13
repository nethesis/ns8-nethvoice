//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { readErrorDetail, readJson, UpstreamError } from './httpError.mjs'

export class CtiClient {
  #baseUrl
  #fetch
  #username
  #password
  #token
  #timeoutMs
  #canLogin

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
    const response = await this.#fetch(`${this.#baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: this.#username, password: this.#password }),
      signal: AbortSignal.timeout(this.#timeoutMs),
    })

    if (!response.ok) {
      throw new UpstreamError(response.status, 'POST', '/api/login', await readErrorDetail(response))
    }
    const body = await readJson(response)

    if (!body || typeof body.token !== 'string' || !body.token) {
      throw new UpstreamError(response.status, 'POST', '/api/login', 'no token in the response')
    }
    this.#token = body.token
  }

  async #request(method, path, body, allowRetry) {
    if (!this.#token) {
      if (!this.#canLogin) {
        throw new UpstreamError(401, method, `/api${path}`, 'no credentials')
      }
      await this.#login()
    }

    const response = await this.#fetch(`${this.#baseUrl}/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.#token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.#timeoutMs),
    })

    if (response.status === 401 && allowRetry && this.#canLogin) {
      this.#token = ''
      return this.#request(method, path, body, false)
    }

    if (!response.ok) {
      throw new UpstreamError(response.status, method, `/api${path}`, await readErrorDetail(response))
    }
    return readJson(response)
  }

  get(path) {
    return this.#request('GET', path, undefined, true)
  }

  post(path, body) {
    return this.#request('POST', path, body, true)
  }
}
