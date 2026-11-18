<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeAvatar } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faStar } from '@fortawesome/free-solid-svg-icons'
import { PRESENCE_DOT } from '@/components/overview/presence'
import { getInitials, type OverviewStatus } from '@/lib/overview/overview'
import { useDensityStore } from '@/stores/density'

type OverviewAvatarSize = 'sm' | 'md' | '3xl'

const {
  name,
  presence,
  size = 'md',
  favorite = false,
  variant = 'card',
} = defineProps<{
  name: string
  presence: OverviewStatus
  size?: OverviewAvatarSize
  favorite?: boolean
  variant?: 'card' | 'row'
}>()

const { t } = useI18n()
const densityStore = useDensityStore()

const DOT_SIZE: Record<OverviewAvatarSize, string> = {
  sm: 'size-2',
  md: 'size-2.5',
  '3xl': 'size-5',
}

const STAR_SIZE: Record<OverviewAvatarSize, string> = {
  sm: 'size-2.5',
  md: 'size-3',
  '3xl': 'size-6',
}

const dotClasses = computed(() =>
  variant === 'row'
    ? '-right-0.5 -bottom-0.5 size-3 ring-elevation-0'
    : ['right-0 bottom-0 ring-white', DOT_SIZE[avatarSize.value]],
)

const initials = computed(() => getInitials(name))

const avatarSize = computed<OverviewAvatarSize>(() =>
  densityStore.isCompact && size === 'sm' ? 'md' : size,
)
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <NeAvatar :size="avatarSize" :initials="initials" :alt="name" />
    <span
      :class="['absolute block rounded-full ring-2', dotClasses, PRESENCE_DOT[presence]]"
      :title="t(`user_overview.status.${presence}`)"
      data-testid="presence-dot"
    >
      <span class="sr-only">{{ t(`user_overview.status.${presence}`) }}</span>
    </span>
    <template v-if="favorite">
      <FontAwesomeIcon
        :icon="faStar"
        :class="[
          'absolute -top-px -right-px scale-130 text-white drop-shadow-[0_0_1px_var(--color-white)]',
          STAR_SIZE[avatarSize],
        ]"
        aria-hidden="true"
      />
      <FontAwesomeIcon
        :icon="faStar"
        :class="[
          'absolute -top-px -right-px text-indigo-700 dark:text-indigo-500',
          STAR_SIZE[avatarSize],
        ]"
        data-testid="favorite-star"
        :aria-label="t('user_overview.favorite')"
      />
    </template>
  </span>
</template>
