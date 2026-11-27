<script setup lang="ts">
import { NeModal } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
// Leaving with unsaved changes: Cancel, Don't save, Save draft.
defineProps<{
  visible: boolean;
  description: string;
  saving?: boolean;
  // CleverAI agents have no draft: they can only be discarded.
  noDraft?: boolean;
}>();
const emit = defineEmits<{ cancel: []; discard: []; save: [] }>();
const { t } = useI18n();
</script>
<template>
  <NeModal
    :visible="visible"
    kind="info"
    :title="t('unsavedDialog.title')"
    :primary-label="noDraft ? t('unsavedDialog.discard') : t('saveDraft')"
    :primary-button-kind="noDraft ? 'danger' : 'primary'"
    :primary-button-loading="saving"
    :primary-button-disabled="saving"
    :secondary-label="noDraft ? undefined : t('unsavedDialog.discard')"
    secondary-button-kind="secondary"
    :secondary-button-disabled="saving"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @primary-click="noDraft ? emit('discard') : emit('save')"
    @secondary-click="emit('discard')"
    @close="emit('cancel')"
    ><p>
      {{ noDraft ? t("unsavedDialog.noDraftHelp") : description }}
    </p></NeModal
  >
</template>
