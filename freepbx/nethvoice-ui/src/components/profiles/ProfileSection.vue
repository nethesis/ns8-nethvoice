<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { NeToggle } from '@nethesis/vue-components'

const {
  sectionId,
  title,
  description = '',
  disabled = false,
  initiallyExpanded = false,
} = defineProps<{
  sectionId: string
  title: string
  description?: string
  disabled?: boolean
  initiallyExpanded?: boolean
}>()

const enabled = defineModel<boolean>({ required: true })

const expanded = ref(initiallyExpanded)
</script>

<template>
  <section class="border-b border-gray-200 pb-4 dark:border-gray-700" :data-section="sectionId">
    <div class="flex items-center justify-between gap-4">
      <button
        type="button"
        class="text-primary-neutral flex items-center gap-2 text-left text-base font-medium"
        :aria-expanded="expanded"
        :aria-controls="`profile-section-${sectionId}`"
        @click="expanded = !expanded"
      >
        <FontAwesomeIcon
          :icon="expanded ? faChevronUp : faChevronDown"
          class="size-3"
          aria-hidden="true"
        />
        {{ title }}
      </button>
      <NeToggle
        v-model="enabled"
        :label="title"
        :disabled="disabled"
        class="[&_label>span:last-child]:sr-only"
      />
    </div>
    <p v-if="description" class="text-tertiary-neutral mt-1 pl-5">{{ description }}</p>
    <div v-show="expanded" :id="`profile-section-${sectionId}`" class="mt-4 space-y-4 pl-5">
      <slot />
    </div>
  </section>
</template>
