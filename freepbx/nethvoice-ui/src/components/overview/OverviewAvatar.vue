<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeAvatar, type AvatarSize } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faStar } from '@fortawesome/free-solid-svg-icons'
import { PRESENCE_DOT } from '@/components/overview/presence'
import { getInitials, type OverviewStatus } from '@/lib/overview/overview'
import { useDensityStore } from '@/stores/density'

const {
  name,
  presence,
  size = 'md',
  favorite = false,
} = defineProps<{
  name: string
  presence: OverviewStatus
  size?: AvatarSize
  favorite?: boolean
}>()

const { t } = useI18n()
const densityStore = useDensityStore()

const DOT_SIZE: Record<AvatarSize, string> = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
  xl: 'size-3.5',
  '2xl': 'size-4',
  '3xl': 'size-4',
  '4xl': 'size-5',
}

const STAR_SIZE: Record<AvatarSize, string> = {
  xs: 'size-2',
  sm: 'size-2.5',
  md: 'size-2.5',
  lg: 'size-3',
  xl: 'size-3.5',
  '2xl': 'size-4',
  '3xl': 'size-4',
  '4xl': 'size-5',
}

const initials = computed(() => getInitials(name))

const avatarSize = computed<AvatarSize>(() =>
  densityStore.isCompact && size === 'sm' ? 'md' : size,
)
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <NeAvatar :size="avatarSize" :initials="initials" :alt="name" />
    <span
      :class="[
        'absolute right-0 bottom-0 block rounded-full ring-2 ring-white',
        DOT_SIZE[avatarSize],
        PRESENCE_DOT[presence],
      ]"
      :title="t(`user_overview.status.${presence}`)"
      data-testid="presence-dot"
    >
      <span class="sr-only">{{ t(`user_overview.status.${presence}`) }}</span>
    </span>
    <FontAwesomeIcon
      v-if="favorite"
      :icon="faStar"
      :class="[
        'absolute top-0 right-0 text-indigo-500 dark:text-indigo-400',
        STAR_SIZE[avatarSize],
      ]"
      data-testid="favorite-star"
      :aria-label="t('user_overview.favorite')"
    />
  </span>
</template>
