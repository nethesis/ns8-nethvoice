<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { useMutation, useQueryCache } from '@pinia/colada'
import { NeCombobox, NeInlineNotification, NeModal, NeSkeleton } from '@nethesis/vue-components'
import LoadError from '@/components/common/LoadError.vue'
import { useOutboundRouteLabels } from '@/composables/useOutboundRouteLabels'
import { useOutboundRouteDefaults } from '@/queries/routes/outbound'
import {
  DefaultRoutesSchema,
  OUTBOUND_ROUTES_KEY,
  postDefaultOutboundRoutes,
} from '@/lib/routes/outbound'
import { getCountryLabel } from '@/lib/settings/system'
import type { Focusable } from '@/lib/common'
import { useSetupStore } from '@/stores/setup'
import { useNotificationsStore } from '@/stores/notifications'

const { visible = false } = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const queryCache = useQueryCache()
const setupStore = useSetupStore()
const notificationsStore = useNotificationsStore()
const { describeRouteError } = useOutboundRouteLabels()
const { state: defaultsState, refetch: refetchDefaults } = useOutboundRouteDefaults()

const country = ref('')
const countryRef = useTemplateRef<Focusable>('countryRef')
const validationIssues = ref<Partial<Record<'country', string>>>({})

const {
  mutate: createRoutesMutate,
  isLoading: createRoutesLoading,
  reset: createRoutesReset,
  error: createRoutesError,
} = useMutation({
  mutation: (pbxLocale: string) => postDefaultOutboundRoutes(pbxLocale),
  onSuccess() {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('routes.default_routes_created'),
        description: t('routes.default_routes_created_description'),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [OUTBOUND_ROUTES_KEY] })
  },
})

const countryOptions = computed(() =>
  (defaultsState.value.data?.locales ?? [])
    .map((pbxLocale) => ({ id: pbxLocale, label: getCountryLabel(pbxLocale, locale.value) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

watch(
  () => visible,
  () => {
    if (visible) {
      createRoutesReset()
      validationIssues.value = {}
      country.value = setupStore.country
    }
  },
)

function createRoutes() {
  validationIssues.value = {}
  const result = v.safeParse(DefaultRoutesSchema, { country: country.value })

  if (!result.success) {
    validationIssues.value = { country: result.issues[0].message }
    countryRef.value?.focus()
    return
  }
  createRoutesMutate(result.output.country)
}
</script>

<template>
  <NeModal
    :visible="visible"
    :title="t('routes.create_default_routes')"
    kind="neutral"
    :primary-label="t('routes.create_routes')"
    :cancel-label="t('common.cancel')"
    :primary-button-disabled="createRoutesLoading || defaultsState.status !== 'success'"
    :primary-button-loading="createRoutesLoading"
    :close-aria-label="t('common.close')"
    @close="emit('close')"
    @primary-click="createRoutes"
  >
    <div class="flex flex-col gap-4">
      <p>{{ t('routes.create_default_routes_description') }}</p>
      <LoadError
        v-if="defaultsState.status === 'error'"
        :error="defaultsState.error"
        @retry="refetchDefaults()"
      />
      <NeSkeleton v-else-if="defaultsState.status === 'pending'" :lines="2" />
      <NeCombobox
        v-else
        ref="countryRef"
        v-model="country"
        :label="t('setup.system.pbx_country')"
        :options="countryOptions"
        :placeholder="t('ne_combobox.choose')"
        :invalid-message="validationIssues.country ? t(validationIssues.country) : ''"
        :disabled="createRoutesLoading"
        :no-results-label="t('ne_combobox.no_results')"
        :limited-options-label="t('ne_combobox.limited_options_label')"
        :no-options-label="t('ne_combobox.no_options_label')"
        :selected-label="t('ne_combobox.selected')"
        :user-input-label="t('ne_combobox.user_input_label')"
        :optional-label="t('common.optional')"
      />
      <NeInlineNotification
        v-if="createRoutesError"
        kind="error"
        :title="t('routes.cannot_create_default_routes')"
        :description="describeRouteError(createRoutesError)"
      />
    </div>
  </NeModal>
</template>
