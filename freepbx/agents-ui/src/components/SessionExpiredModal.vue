<script setup lang="ts">
import { NeModal } from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
// The session expired while editing: the changes stay on the page and the
// save resumes after signing in again.
defineProps<{ visible: boolean }>();
const emit = defineEmits<{ cancel: []; signIn: [] }>();
const { t } = useI18n();
</script>
<template>
  <NeModal
    :visible="visible"
    kind="warning"
    :title="t('sessionDialog.title')"
    :primary-label="t('sessionDialog.signIn')"
    :cancel-label="t('cancel')"
    :close-aria-label="t('close')"
    @primary-click="emit('signIn')"
    @close="emit('cancel')"
    ><p>{{ t("sessionDialog.description") }}</p></NeModal
  >
</template>
