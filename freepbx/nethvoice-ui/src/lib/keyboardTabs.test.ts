//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vKeyboardTabs } from './keyboardTabs'

const mountTabs = (labels: string[]) => {
  const tabs = ref(labels)
  const onSelect = vi.fn()
  const root = document.createElement('div')
  document.body.appendChild(root)

  const app = createApp(
    defineComponent({
      setup: () => () =>
        withDirectives(
          h('div', [
            h(
              'nav',
              tabs.value.map((label) =>
                h('a', { key: label, onClick: () => onSelect(label) }, label),
              ),
            ),
          ]),
          [[vKeyboardTabs]],
        ),
    }),
  )
  app.mount(root)
  return { root, tabs, onSelect }
}

describe('vKeyboardTabs', () => {
  it('should make the tabs without href reachable with the keyboard', async () => {
    const { root, tabs } = mountTabs(['VoIP', 'Physical'])
    const anchors = () => [...root.querySelectorAll('a')]

    expect(anchors().map((anchor) => anchor.getAttribute('tabindex'))).toEqual(['0', '0'])
    expect(anchors()[0].getAttribute('role')).toBe('link')

    tabs.value = [...tabs.value, 'Other']
    await nextTick()

    expect(anchors()[2].getAttribute('tabindex')).toBe('0')
  })

  it('should select a tab with Enter and Space', () => {
    const { root, onSelect } = mountTabs(['VoIP', 'Physical'])
    const [first, second] = root.querySelectorAll('a')

    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    second.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))

    expect(onSelect.mock.calls).toEqual([['VoIP'], ['Physical']])
  })
})
