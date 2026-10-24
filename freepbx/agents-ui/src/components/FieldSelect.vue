<script setup lang="ts">
import { NeListbox } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
defineProps<{
  modelValue: string;
  label: string;
  options: { id: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  helperText?: string;
}>();
defineEmits<{ "update:modelValue": [value: string] }>();
const { t } = useI18n();
</script>
<template>
  <NeListbox
    :model-value="modelValue"
    :label="label"
    :options="options"
    :disabled="disabled"
    :helper-text="helperText"
    :no-options-label="t('noOptions')"
    :optional-label="t('optional')"
    @update:model-value="$emit('update:modelValue', String($event))"
  />
</template>
