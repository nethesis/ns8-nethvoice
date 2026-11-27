<script setup lang="ts">
import { onMounted, ref, useId, watch } from "vue";
import { NeToggle } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import InfoTip from "./InfoTip.vue";
// Nethesis toggle: setting name on top, Enabled or Disabled next to the
// switch, description in a tooltip.
const props = defineProps<{
  modelValue: boolean;
  label: string;
  tip?: string;
  disabled?: boolean;
  // Shown under the switch, for what the user needs to know.
  helperText?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const { t } = useI18n();
const root = ref<HTMLElement>();
const helperId = useId();
// NeToggle names the switch with its side label (Enabled or Disabled), not
// with the top label: name it after the setting for screen readers.
function name() {
  const input = root.value?.querySelector("input");
  input?.setAttribute("aria-label", props.label);
  if (props.helperText) input?.setAttribute("aria-describedby", helperId);
  else input?.removeAttribute("aria-describedby");
}
onMounted(name);
watch(() => [props.label, props.helperText], name, { flush: "post" });
</script>
<template>
  <div ref="root">
    <NeToggle
      :model-value="modelValue"
      :top-label="label"
      :label="t(modelValue ? 'agentEditor.enabled' : 'agentEditor.disabled')"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template v-if="tip" #topTooltip>
        <InfoTip
          :text="tip"
          :label="t('agentEditor.moreInfo', { name: label })"
        />
      </template>
    </NeToggle>
    <p v-if="helperText" :id="helperId" class="text-muted mt-2 text-sm">
      {{ helperText }}
    </p>
  </div>
</template>
