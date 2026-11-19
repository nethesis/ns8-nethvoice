<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeHeading,
  NeInlineNotification,
  NeSideDrawer,
  NeTextInput,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import type { TimeGroupData } from '@/lib/visualplan/api'
import {
  EMPTY_RULE,
  formatTimeRule,
  MONTHS,
  parseTimeRule,
  validateTimeRule,
  WEEKDAYS,
  type TimeRule,
} from '@/lib/visualplan/timeGroups'
import SelectField from '@/components/visualplan/SelectField.vue'

const {
  isShown = false,
  group = null,
  usedBy = 0,
} = defineProps<{
  isShown: boolean
  group: TimeGroupData | null
  usedBy?: number
}>()

const emit = defineEmits<{ close: []; save: [group: TimeGroupData] }>()

const { t } = useI18n()

const description = ref('')
const rules = ref<TimeRule[]>([])
const submitted = ref(false)

watch(
  () => isShown,
  () => {
    if (isShown) {
      description.value = group?.description ?? ''
      rules.value = group?.times.length ? group.times.map(parseTimeRule) : [{ ...EMPTY_RULE }]
      submitted.value = false
    }
  },
)

const anyOption = computed(() => ({ id: '', label: t('visual_plan.time_group.any') }))
const dayOptions = computed(() => [
  anyOption.value,
  ...WEEKDAYS.map((day) => ({ id: day, label: t(`visual_plan.time_group.weekdays.${day}`) })),
])
const monthOptions = computed(() => [
  anyOption.value,
  ...MONTHS.map((month) => ({ id: month, label: t(`visual_plan.time_group.months.${month}`) })),
])

const ruleErrors = computed(() => rules.value.map(validateTimeRule))
const descriptionError = computed(() =>
  submitted.value && !description.value.trim() ? t('visual_plan.issues.required') : '',
)
const ruleError = (index: number, field: string): string => {
  const errors = ruleErrors.value[index] ?? []
  if (!submitted.value || !errors.includes(field)) return ''
  const rule = rules.value[index]
  if (field === 'startTime' || field === 'endTime') {
    return t('visual_plan.issues.time_required')
  }
  if (field === 'startDate' || field === 'endDate') {
    return rule && !rule.startDate && rule.endDate && field === 'startDate'
      ? t('visual_plan.issues.start_required')
      : t('visual_plan.issues.day_of_month')
  }
  return t('visual_plan.issues.start_required')
}

const alwaysError = (index: number): string =>
  submitted.value && ruleErrors.value[index]?.includes('always')
    ? t('visual_plan.issues.always')
    : ''

const form = useTemplateRef<HTMLFormElement>('form')

function save() {
  submitted.value = true
  if (!description.value.trim() || ruleErrors.value.some((errors) => errors.length)) {
    nextTick(() => {
      const target =
        form.value?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        form.value?.querySelector<HTMLElement>('.text-rose-700')
      target?.scrollIntoView({ block: 'center' })
      if (target instanceof HTMLInputElement) target.focus()
    })
    return
  }
  emit('save', {
    id: group?.id ?? null,
    description: description.value.trim(),
    times: rules.value.map(formatTimeRule),
  })
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="group ? t('visual_plan.time_group.edit') : t('visual_plan.time_group.create')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form ref="form" class="space-y-8" @submit.prevent="save">
      <NeInlineNotification
        v-if="group && usedBy > 0"
        kind="warning"
        :title="t('visual_plan.time_group.shared', { count: usedBy }, usedBy)"
      />
      <NeTextInput
        v-model="description"
        :label="t('visual_plan.fields.name')"
        :invalid-message="descriptionError"
      />
      <div v-for="(rule, index) in rules" :key="index" class="space-y-4">
        <div class="flex items-center justify-between">
          <NeHeading tag="h6">
            {{ t('visual_plan.time_group.rule', { number: index + 1 }) }}
          </NeHeading>
          <NeButton
            v-if="rules.length > 1"
            kind="tertiary"
            size="sm"
            @click="rules.splice(index, 1)"
          >
            <template #prefix>
              <FontAwesomeIcon :icon="faCircleMinus" aria-hidden="true" />
            </template>
            {{ t('common.remove') }}
          </NeButton>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <NeTextInput
            v-model="rule.startTime"
            type="time"
            :label="t('visual_plan.time_group.start_time')"
            :invalid-message="ruleError(index, 'startTime')"
          />
          <NeTextInput
            v-model="rule.endTime"
            type="time"
            :label="t('visual_plan.time_group.end_time')"
            :invalid-message="ruleError(index, 'endTime')"
          />
          <SelectField
            v-model="rule.startDay"
            :label="t('visual_plan.time_group.start_day')"
            :invalid-message="ruleError(index, 'startDay')"
            :options="dayOptions"
          />
          <SelectField
            v-model="rule.endDay"
            :label="t('visual_plan.time_group.end_day')"
            :options="dayOptions"
          />
          <NeTextInput
            v-model="rule.startDate"
            :label="t('visual_plan.time_group.start_date')"
            :helper-text="t('visual_plan.time_group.day_of_month_helper')"
            :invalid-message="ruleError(index, 'startDate')"
          />
          <NeTextInput
            v-model="rule.endDate"
            :label="t('visual_plan.time_group.end_date')"
            :helper-text="t('visual_plan.time_group.day_of_month_helper')"
            :invalid-message="ruleError(index, 'endDate')"
          />
          <SelectField
            v-model="rule.startMonth"
            :label="t('visual_plan.time_group.start_month')"
            :invalid-message="ruleError(index, 'startMonth')"
            :options="monthOptions"
          />
          <SelectField
            v-model="rule.endMonth"
            :label="t('visual_plan.time_group.end_month')"
            :options="monthOptions"
          />
        </div>
        <p v-if="alwaysError(index)" class="text-sm text-rose-700 dark:text-rose-400">
          {{ alwaysError(index) }}
        </p>
      </div>
      <NeButton kind="secondary" @click="rules.push({ ...EMPTY_RULE })">
        <template #prefix>
          <FontAwesomeIcon :icon="faPlus" aria-hidden="true" />
        </template>
        {{ t('visual_plan.time_group.add_rule') }}
      </NeButton>
      <hr />
      <div class="flex justify-end gap-4">
        <NeButton kind="tertiary" @click="emit('close')">{{ t('common.cancel') }}</NeButton>
        <NeButton kind="primary" type="submit">{{
          group ? t('visual_plan.time_group.apply') : t('visual_plan.time_group.create_button')
        }}</NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
