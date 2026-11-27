<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeButton } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleArrowUp } from '@fortawesome/free-solid-svg-icons'
import { useVisualPlanStore } from '@/stores/visualPlan'
import SelectField from '@/components/visualplan/SelectField.vue'
import UploadRecordingModal from '@/components/visualplan/UploadRecordingModal.vue'

const props = defineProps<{
  label: string
  modelValue: number | null
  invalidMessage?: string
  optional?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const uploadShown = ref(false)

const options = computed(() => [
  ...(props.optional ? [{ id: '', label: t('common.none') }] : []),
  ...(store.data?.recordings ?? []).map((recording) => ({
    id: String(recording.id),
    label: recording.name,
    description: recording.description,
  })),
])

const selected = computed({
  get: () => (props.modelValue === null ? '' : String(props.modelValue)),
  set: (value: string) => emit('update:modelValue', value ? Number(value) : null),
})
</script>

<template>
  <div>
    <SelectField
      v-model="selected"
      :label="label"
      :options="options"
      :placeholder="t('visual_plan.fields.choose_recording')"
      :invalid-message="invalidMessage"
      :optional="optional"
      :disabled="disabled"
    />
    <NeButton v-if="!disabled" kind="tertiary" class="mt-2 -ml-2.5" @click="uploadShown = true">
      <template #prefix>
        <FontAwesomeIcon :icon="faCircleArrowUp" class="size-4" aria-hidden="true" />
      </template>
      {{ t('visual_plan.upload_recording') }}
    </NeButton>
    <UploadRecordingModal
      :visible="uploadShown"
      @close="uploadShown = false"
      @uploaded="(id) => emit('update:modelValue', id)"
    />
  </div>
</template>
