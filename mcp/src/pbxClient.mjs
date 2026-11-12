//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from 'node:crypto'
import { readErrorDetail, readJson, UpstreamError } from './httpError.mjs'

const sha1 = (text) => createHash('sha1').update(text, 'utf8').digest('hex')

export const buildSecretKey = (username, password, sharedSecret) =>
  sha1(`${username}${sha1(password)}${sharedSecret}`)

export class PbxClient {
  #baseUrl
  #fetch
  #username
  #password
  #secretKey = ''
  #timeoutMs

  constructor({ baseUrl, username, password, timeoutMs = 15000, fetch }) {
    this.#baseUrl = baseUrl
    this.#fetch = fetch ?? globalThis.fetch
    this.#username = username
    this.#password = password
    this.#timeoutMs = timeoutMs
  }

  async #authenticate() {
    const path = '/freepbx/rest/testauth'
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: this.#username, password: this.#password }),
      signal: AbortSignal.timeout(this.#timeoutMs),
    })

    if (!response.ok) {
      throw new UpstreamError(response.status, 'POST', path, await readErrorDetail(response))
    }
    const body = await readJson(response)

    if (!body || typeof body.result !== 'string' || !body.result) {
      throw new UpstreamError(response.status, 'POST', path, 'no shared secret in the response')
    }
    this.#secretKey = buildSecretKey(this.#username, this.#password, body.result)
  }

  async get(path) {
    if (!this.#secretKey) {
      await this.#authenticate()
    }
    const fullPath = `/freepbx/rest${path}`
    const response = await this.#fetch(`${this.#baseUrl}${fullPath}`, {
      method: 'GET',
      headers: { Accept: 'application/json', User: this.#username, Secretkey: this.#secretKey },
      signal: AbortSignal.timeout(this.#timeoutMs),
    })

    if (!response.ok) {
      throw new UpstreamError(response.status, 'GET', fullPath, await readErrorDetail(response))
    }
    return readJson(response)
  }
}
