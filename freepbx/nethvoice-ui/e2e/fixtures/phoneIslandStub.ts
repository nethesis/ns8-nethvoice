//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

type PhoneIslandOptions = { dataConfig: string; displayName: string }

const dispatch = (name: string, detail: object = {}) =>
  window.dispatchEvent(new CustomEvent(name, { detail }))

const readNumber = (event: Event): string => {
  if (!(event instanceof CustomEvent) || typeof event.detail !== 'object' || !event.detail) {
    return ''
  }
  const number: unknown = Reflect.get(event.detail, 'number')
  return typeof number === 'string' ? number : ''
}

export const mountPhoneIsland = (element: HTMLElement, options: PhoneIslandOptions) => {
  const island = document.createElement('div')

  island.dataset.testid = 'phone-island-stub'
  island.dataset.config = options.dataConfig
  island.dataset.displayName = options.displayName
  element.append(island)

  const onCallStart = (event: Event) => {
    island.dataset.calls = [island.dataset.calls, readNumber(event)].filter(Boolean).join(',')
    dispatch('phone-island-call-started')
  }
  const onCallEnd = () => dispatch('phone-island-call-ended')

  window.addEventListener('phone-island-call-start', onCallStart)
  window.addEventListener('phone-island-call-end', onCallEnd)

  const timer = setTimeout(() => {
    if (Reflect.get(window, 'phoneIslandStubFailure') === true) {
      dispatch('phone-island-alert-set', { type: 'webrtc_down' })
    } else {
      dispatch('phone-island-webrtc-registered')
    }
  }, 100)

  return {
    unmount: () => {
      clearTimeout(timer)
      window.removeEventListener('phone-island-call-start', onCallStart)
      window.removeEventListener('phone-island-call-end', onCallEnd)
      island.remove()
    },
  }
}
