<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeAvatar, type AvatarSize } from '@nethesis/vue-components'
import { getInitials, type OverviewStatus } from '@/lib/overview/overview'

const {
  name,
  presence,
  size = 'md',
} = defineProps<{
  name: string
  presence: OverviewStatus
  size?: AvatarSize
}>()

const { t } = useI18n()

const PRESENCE_DOT: Record<OverviewStatus, string> = {
  online: 'bg-green-500',
  busy: 'bg-rose-500',
  ringing: 'bg-rose-500',
  dnd: 'bg-rose-500',
  offline: 'bg-gray-400',
}

const initials = computed(() => getInitials(name))
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <NeAvatar :size="size" :initials="initials" :alt="name" />
    <span
      :class="[
        'ring-elevation-0 absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2',
        PRESENCE_DOT[presence],
      ]"
      :title="t(`user_overview.status.${presence}`)"
    >
      <span class="sr-only">{{ t(`user_overview.status.${presence}`) }}</span>
    </span>
  </span>
</template>
