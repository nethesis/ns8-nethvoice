<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { NeTextArea } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { invalidJsonEditors } from "../jsonValidity";
const validityKey = Symbol();
onUnmounted(() => invalidJsonEditors.delete(validityKey));
defineOptions({ inheritAttrs: false });
const props = defineProps<{
  modelValue: unknown;
  label: string;
  rows?: number;
  shape?: "object" | "array";
}>();
const emit = defineEmits<{
  "update:modelValue": [value: any];
  valid: [value: boolean];
}>();
const { t } = useI18n();
const text = ref(""),
  invalid = ref(false);
watch(
  () => props.modelValue,
  (value) => {
    if (!invalid.value) text.value = JSON.stringify(value, null, 2);
  },
  { immediate: true, deep: true },
);
function update(value: string) {
  text.value = value;
  try {
    const parsed = JSON.parse(value);
    if (
      props.shape === "object" &&
      (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    )
      throw new Error();
    if (props.shape === "array" && !Array.isArray(parsed)) throw new Error();
    invalid.value = false;
    invalidJsonEditors.delete(validityKey);
    emit("update:modelValue", parsed);
    emit("valid", true);
  } catch {
    invalid.value = true;
    invalidJsonEditors.add(validityKey);
    emit("valid", false);
  }
}
</script>
<template>
  <NeTextArea
    :model-value="text"
    :label="label"
    :rows="rows || 6"
    :invalid-message="invalid ? t('invalidJson') : ''"
    class="font-mono"
    @update:model-value="update"
  />
</template>
