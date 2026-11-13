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
  surface = 'card',
} = defineProps<{
  name: string
  presence: OverviewStatus
  size?: AvatarSize
  surface?: 'card' | 'drawer'
}>()

const { t } = useI18n()

const PRESENCE_DOT: Record<OverviewStatus, string> = {
  online: 'bg-green-500',
  busy: 'bg-rose-500',
  ringing: 'bg-rose-500',
  dnd: 'bg-rose-500',
  forward: 'bg-amber-500',
  offline: 'bg-gray-400',
}

const DOT_SIZE: Record<AvatarSize, string> = {
  xs: 'size-1.5',
  sm: 'size-2.5',
  md: 'size-3',
  lg: 'size-3',
  xl: 'size-3.5',
  '2xl': 'size-4',
  '3xl': 'size-5',
  '4xl': 'size-6',
}

const SURFACE_RING = {
  card: 'ring-elevation-0',
  drawer: 'ring-elevation-1',
}

const initials = computed(() => getInitials(name))
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <NeAvatar :size="size" :initials="initials" :alt="name" />
    <span
      :class="[
        'absolute right-0 bottom-0 block rounded-full ring-2',
        DOT_SIZE[size],
        SURFACE_RING[surface],
        PRESENCE_DOT[presence],
      ]"
      :title="t(`user_overview.status.${presence}`)"
      data-testid="presence-dot"
    >
      <span class="sr-only">{{ t(`user_overview.status.${presence}`) }}</span>
    </span>
  </span>
</template>
