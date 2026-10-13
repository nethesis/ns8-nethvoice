<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeTextInput,
  NeTextArea,
  NeButton,
  NeStepper,
  NeInlineNotification,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { workflow, refreshInventory } from "../api";
import { blankGraph, identifier, upgrade } from "../model";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import FieldSelect from "../components/FieldSelect.vue";
import type { Graph } from "../types";
const { t } = useI18n();
const route = useRoute(),
  router = useRouter();
const { pending, error, run } = useTask();
const name = ref(""),
  description = ref(""),
  channel = ref("voice"),
  template = ref("blank");
const kind = computed(() =>
  route.meta.kind === "subflow" ? "subflow" : "agent",
);
const catalog = useQuery({
  queryKey: ["catalog"],
  queryFn: () => workflow("GET", "/catalog"),
});
const templates = computed(() =>
  (catalog.data.value?.templates || []).filter((g: Graph) =>
    g.entrypoints.includes(channel.value),
  ),
);
async function create() {
  await run(async () => {
    const id = identifier(name.value);
    const seed = templates.value.find(
      (g: Graph) => g.agent_id === template.value,
    );
    const graph = seed
      ? upgrade(seed)
      : blankGraph(id, name.value, channel.value);
    graph.agent_id = id;
    graph.name = name.value;
    graph.description = description.value;
    await workflow("PUT", `/definitions/${kind.value}/${id}`, {
      definition: graph,
      expected_revision: 0,
    });
    await refreshInventory();
    await router.push(
      `/${kind.value === "agent" ? "agents" : "workflows"}/${id}/general`,
    );
  });
}
</script>
<template>
  <PageHeader :title="t(kind === 'agent' ? 'newAgent' : 'newWorkflow')" />
  <form class="nv-panel max-w-4xl space-y-6" @submit.prevent="create">
    <NeStepper :total-steps="3" :current-step="1" :step-label="t('identity')" />
    <NeInlineNotification v-if="error" kind="error" :title="error" />
    <NeTextInput v-model="name" :label="t('name')" required maxlength="128" />
    <NeTextArea
      v-model="description"
      :label="t('description')"
      :rows="3"
      maxlength="1024"
    />
    <FieldSelect
      v-model="channel"
      :label="t('channel')"
      :options="[
        { id: 'voice', label: t('voice') },
        { id: 'api', label: t('api') },
      ]"
    />
    <FieldSelect
      v-model="template"
      :label="t('template')"
      :options="[
        { id: 'blank', label: t('blank') },
        ...templates.map((g: Graph) => ({ id: g.agent_id, label: g.name })),
      ]"
    />
    <div class="nv-action-bar">
      <NeButton
        kind="primary"
        :loading="pending"
        :disabled="!name.trim()"
        @click="create"
        >{{ t("create") }}</NeButton
      ><RouterLink to="/agents"
        ><NeButton>{{ t("cancel") }}</NeButton></RouterLink
      >
    </div>
  </form>
</template>
