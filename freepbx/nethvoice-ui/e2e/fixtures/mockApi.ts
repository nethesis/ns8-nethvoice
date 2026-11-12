//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { test as base, expect, type Page, type Route } from '@playwright/test'

export type MockRequest = {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  headers: Record<string, string>
}

export type MockResponse = {
  status?: number
  json?: unknown
  body?: string
  contentType?: string
}

export type MockHandler = (request: MockRequest) => MockResponse | Promise<MockResponse>

export type RecordedCall = { method: string; path: string; body: unknown }

const API_PREFIXES = ['/freepbx/rest', '/api', '/tancredi/api/v1']

export const E2E_CREDENTIALS = { user: 'admin', hash: 'e2e-secret-key' }

const routeKey = (method: string, path: string) => `${method.toUpperCase()} ${path}`

const toPattern = (path: string) =>
  new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z_]+/g, '[^/]+')}$`)

export class MockApi {
  readonly calls: RecordedCall[] = []
  private unmockedAllowed = false
  private readonly handlers = new Map<string, { pattern: RegExp; handler: MockHandler }>()

  on(method: string, path: string, handler: MockHandler | MockResponse) {
    this.handlers.set(routeKey(method, path), {
      pattern: toPattern(path),
      handler: typeof handler === 'function' ? handler : () => handler,
    })
    return this
  }

  allowUnmockedCalls() {
    this.unmockedAllowed = true
    return this
  }

  callsTo(method: string, path: string): RecordedCall[] {
    const pattern = toPattern(path)
    return this.calls.filter(
      (call) => call.method === method.toUpperCase() && pattern.test(call.path),
    )
  }

  async install(page: Page) {
    await page.route(
      (url) => API_PREFIXES.some((prefix) => url.pathname.startsWith(`${prefix}/`)),
      (route) => this.fulfill(route),
    )
  }

  private async fulfill(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method().toUpperCase()
    let body: unknown = null

    try {
      body = request.postDataJSON()
    } catch {
      body = request.postData()
    }

    this.calls.push({ method, path: url.pathname, body })

    const match = [...this.handlers.entries()].find(
      ([key, entry]) => key.startsWith(`${method} `) && entry.pattern.test(url.pathname),
    )

    if (!match) {
      await route.fulfill({
        status: 599,
        contentType: 'application/json',
        body: JSON.stringify({ error: `e2e: no mock for ${method} ${url.pathname}` }),
      })
      return
    }

    const response = await match[1].handler({
      method,
      path: url.pathname,
      query: url.searchParams,
      body,
      headers: request.headers(),
    })

    await route.fulfill({
      status: response.status ?? 200,
      contentType: response.contentType ?? 'application/json',
      body: response.body ?? (response.json === undefined ? '' : JSON.stringify(response.json)),
    })
  }

  unmockedCalls(): RecordedCall[] {
    if (this.unmockedAllowed) {
      return []
    }
    return this.calls.filter(
      (call) =>
        ![...this.handlers.entries()].some(
          ([key, entry]) => key.startsWith(`${call.method} `) && entry.pattern.test(call.path),
        ),
    )
  }
}

type Fixtures = {
  mockApi: MockApi
  signedIn: void
}

export const test = base.extend<Fixtures>({
  mockApi: async ({ page }, use) => {
    const mockApi = new MockApi()

    mockApi
      .on('GET', '/freepbx/rest/login', { json: { success: true } })
      .on('GET', '/freepbx/rest/logout', { json: { success: true } })
      .on('GET', '/freepbx/rest/configuration/wizard', { json: [{ step: 13, status: 'false' }] })
      .on('POST', '/freepbx/rest/configuration/wizard', { status: 200 })

    await mockApi.install(page)
    await use(mockApi)

    expect(mockApi.unmockedCalls(), 'every API call of a spec must be mocked').toEqual([])
  },

  signedIn: async ({ page }, use) => {
    await page.addInitScript((credentials) => {
      localStorage.setItem('secretkey', JSON.stringify(credentials))
    }, E2E_CREDENTIALS)
    await use()
  },
})

export { expect }
