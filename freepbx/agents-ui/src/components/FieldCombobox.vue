<script setup lang="ts">
import { ref, watch } from "vue";
import { NeCombobox, type NeComboboxOption } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
const props = defineProps<{
  modelValue: string;
  label: string;
  options: NeComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
  invalidMessage?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const { t } = useI18n();
const generation = ref(0);
let emitted = props.modelValue;
watch(
  () => props.modelValue,
  (value) => {
    if (value !== emitted) generation.value++;
    emitted = value;
  },
);
function update(value: unknown) {
  emitted = String(value || "");
  emit("update:modelValue", emitted);
}
</script>
<template>
  <NeCombobox
    :key="generation"
    :model-value="modelValue"
    :label="label"
    :options="options"
    :placeholder="placeholder"
    :disabled="disabled"
    :helper-text="helperText"
    :invalid-message="invalidMessage"
    :selected-label="t('selectedOption')"
    :no-results-label="t('noResults')"
    :limited-options-label="t('moreOptions')"
    :no-options-label="t('noOptions')"
    :user-input-label="t('userInput')"
    :optional-label="t('optional')"
    @update:model-value="update"
  />
</template>
