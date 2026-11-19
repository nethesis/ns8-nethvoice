<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NeHeading, NeModal } from '@nethesis/vue-components'

const { visible = false } = defineProps<{ visible: boolean }>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

type Token = { key: string } | { keyName: string } | { word: string }

type Shortcut = { action: string; ways: { tokens: Token[]; note?: string }[] }

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent)

const MOD: Token = { key: IS_MAC ? '⌘' : 'Ctrl' }
const SHIFT: Token = { key: IS_MAC ? '⇧' : 'Shift' }
const key = (value: string): Token => ({ key: value })
const word = (value: string): Token => ({ word: value })

const SECTIONS: { id: string; shortcuts: Shortcut[] }[] = [
  {
    id: 'canvas',
    shortcuts: [
      { action: 'move_tool', ways: [{ tokens: [key('H')] }] },
      { action: 'select_tool', ways: [{ tokens: [key('V')] }] },
      {
        action: 'pan',
        ways: [
          { tokens: [word('drag')], note: 'with_move_tool' },
          { tokens: [word('scroll')] },
          { tokens: [{ keyName: 'space' }, word('drag')] },
        ],
      },
      { action: 'zoom', ways: [{ tokens: [MOD, word('scroll')] }] },
      { action: 'focus_item', ways: [{ tokens: [{ keyName: 'tab' }] }] },
      { action: 'select_item', ways: [{ tokens: [{ keyName: 'enter' }] }] },
      { action: 'move_item', ways: [{ tokens: [{ keyName: 'arrows' }] }] },
    ],
  },
  {
    id: 'selection',
    shortcuts: [
      {
        action: 'select_area',
        ways: [
          { tokens: [word('drag')], note: 'with_select_tool' },
          { tokens: [SHIFT, word('drag')] },
        ],
      },
      { action: 'select_more', ways: [{ tokens: [MOD, word('click')] }] },
      { action: 'select_all', ways: [{ tokens: [MOD, key('A')] }] },
      { action: 'clear_selection', ways: [{ tokens: [key('Esc')] }] },
    ],
  },
  {
    id: 'editing',
    shortcuts: [
      { action: 'connect', ways: [{ tokens: [word('drag_destination')] }] },
      { action: 'quick_add', ways: [{ tokens: [word('drag_to_empty')] }] },
      {
        action: 'delete',
        ways: [{ tokens: [{ keyName: 'delete' }] }, { tokens: [key('⌫')] }],
      },
      { action: 'undo', ways: [{ tokens: [MOD, key('Z')] }] },
      { action: 'redo', ways: [{ tokens: [MOD, SHIFT, key('Z')] }, { tokens: [MOD, key('Y')] }] },
      { action: 'save', ways: [{ tokens: [MOD, key('S')] }] },
      { action: 'help', ways: [{ tokens: [key('?')] }] },
    ],
  },
]
</script>

<template>
  <NeModal
    :visible="visible"
    :title="t('visual_plan.shortcuts.title')"
    kind="neutral"
    size="lg"
    :primary-label="t('common.close')"
    primary-button-kind="secondary"
    :close-aria-label="t('common.close')"
    @close="emit('close')"
    @primary-click="emit('close')"
  >
    <div class="space-y-5">
      <section v-for="section in SECTIONS" :key="section.id" class="space-y-2">
        <NeHeading tag="h6">{{ t(`visual_plan.shortcuts.sections.${section.id}`) }}</NeHeading>
        <dl class="divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="shortcut in section.shortcuts"
            :key="shortcut.action"
            class="flex flex-col gap-1 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <dt class="text-secondary-neutral text-sm">
              {{ t(`visual_plan.shortcuts.actions.${shortcut.action}`) }}
            </dt>
            <dd class="flex flex-wrap items-center gap-x-2 gap-y-1 sm:justify-end">
              <template v-for="(way, wayIndex) in shortcut.ways" :key="wayIndex">
                <span v-if="wayIndex > 0" class="text-tertiary-neutral text-xs">
                  {{ t('visual_plan.shortcuts.or') }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <template v-for="(token, tokenIndex) in way.tokens" :key="tokenIndex">
                    <span
                      v-if="tokenIndex > 0"
                      class="text-tertiary-neutral text-xs"
                      aria-hidden="true"
                    >
                      +
                    </span>
                    <kbd
                      v-if="'key' in token || 'keyName' in token"
                      class="bg-elevation-2 text-primary-neutral inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 font-sans text-xs font-medium shadow-sm ring-1 ring-gray-300 dark:ring-gray-600"
                    >
                      {{
                        'key' in token
                          ? token.key
                          : t(`visual_plan.shortcuts.keys.${token.keyName}`)
                      }}
                    </kbd>
                    <span v-else class="text-primary-neutral text-xs font-medium">
                      {{ t(`visual_plan.shortcuts.words.${token.word}`) }}
                    </span>
                  </template>
                  <span v-if="way.note" class="text-tertiary-neutral text-xs">
                    ({{ t(`visual_plan.shortcuts.notes.${way.note}`) }})
                  </span>
                </span>
              </template>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </NeModal>
</template>
