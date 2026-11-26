<script setup lang="ts">
import { NeModal } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
// The agent was saved elsewhere after it was opened.
defineProps<{ visible: boolean; name: string; saving?: boolean }>();
const emit = defineEmits<{ cancel: []; discard: []; keep: [] }>();
const { t } = useI18n();
</script>
<template>
  <NeModal
    :visible="visible"
    kind="warning"
    :title="t('conflictDialog.title')"
    :primary-label="t('conflictDialog.keep')"
    :primary-button-loading="saving"
    :primary-button-disabled="saving"
    :secondary-label="t('conflictDialog.discard')"
    secondary-button-kind="secondary"
    :secondary-button-disabled="saving"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @primary-click="emit('keep')"
    @secondary-click="emit('discard')"
    @close="emit('cancel')"
    ><p>{{ t("conflictDialog.description", { name }) }}</p></NeModal
  >
</template>
