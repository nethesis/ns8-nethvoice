//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

const waitForAbort = (signal) =>
  new Promise((resolve, reject) => {
    if (!signal) {
      return
    }

    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const keepAlive = setInterval(() => {}, 1000)

    signal.addEventListener(
      'abort',
      () => {
        clearInterval(keepAlive)
        reject(signal.reason)
      },
      { once: true },
    )
  })

export const networkError = (code) => new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) })

export const createFakeFetch = (routes) => {
  const calls = []

  const fetch = async (url, init = {}) => {
    const { pathname, search } = new URL(url)
    const method = init.method ?? 'GET'
    const call = {
      method,
      path: pathname + search,
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)

    const handler = routes[`${method} ${pathname}`]

    if (!handler) {
      return new Response(JSON.stringify({ error: 'no route' }), { status: 404 })
    }
    const result = typeof handler === 'function' ? await handler(call) : handler

    if (result.throws) {
      throw result.throws
    }

    if (result.hang) {
      await waitForAbort(init.signal)
    }
    const { status = 200, json } = result

    return new Response(json === undefined ? '' : JSON.stringify(json), { status })
  }

  return { fetch, calls }
}
