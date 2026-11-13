<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { NeToggle, NeTooltip } from '@nethesis/vue-components'
import { isFeatureImplied, type FeatureNode } from '@/lib/profiles/features'
import { getFeatureValue, setFeatureValue, type ProfileForm } from '@/lib/profiles/profiles'

defineOptions({ name: 'ProfileFeatureToggle' })

const {
  node,
  form,
  parentEnabled = true,
  disabled = false,
  subscriptionActive = true,
} = defineProps<{
  node: FeatureNode
  form: ProfileForm
  parentEnabled?: boolean
  disabled?: boolean
  subscriptionActive?: boolean
}>()

const { t } = useI18n()

const implied = computed(() => isFeatureImplied(form, node))

const blockedBySubscription = computed(() => node.requiresSubscription && !subscriptionActive)

const value = computed({
  get: () => getFeatureValue(form, node.ref) || implied.value,
  set: (newValue: boolean) => setFeatureValue(form, node.ref, newValue),
})

const toggleDisabled = computed(
  () => disabled || !parentEnabled || implied.value || blockedBySubscription.value,
)

const childrenEnabled = computed(
  () => parentEnabled && (!node.gatesChildren || getFeatureValue(form, node.ref)),
)
</script>

<template>
  <div :data-feature="node.key">
    <NeToggle
      v-model="value"
      :top-label="t(node.labelKey, node.labelParams)"
      :label="value ? t('common.enabled') : t('common.disabled')"
      :disabled="toggleDisabled"
    >
      <template v-if="node.tooltipKey" #topTooltip>
        <NeTooltip class="inline-block align-middle">
          <template #trigger>
            <FontAwesomeIcon
              :icon="faCircleInfo"
              class="size-3.5 text-indigo-500 dark:text-indigo-300"
              :aria-label="t(node.tooltipKey)"
            />
          </template>
          <template #content>{{ t(node.tooltipKey) }}</template>
        </NeTooltip>
      </template>
      <template v-if="blockedBySubscription" #tooltip>
        <NeTooltip class="inline-block align-middle">
          <template #trigger>
            <FontAwesomeIcon
              :icon="faCircleInfo"
              class="text-tertiary-neutral size-3.5"
              :aria-label="t('profiles.subscription_required')"
            />
          </template>
          <template #content>{{ t('profiles.subscription_required') }}</template>
        </NeTooltip>
      </template>
    </NeToggle>
    <div v-if="node.children.length" class="mt-4 space-y-4 pl-6">
      <ProfileFeatureToggle
        v-for="child in node.children"
        :key="child.key"
        :node="child"
        :form="form"
        :parent-enabled="childrenEnabled"
        :disabled="disabled"
        :subscription-active="subscriptionActive"
      />
    </div>
  </div>
</template>
