<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeInlineNotification,
  NeExpandable,
  NeModal,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { inventory, request, workflow } from "../api";
import { useTask } from "../composables/useTask";
import PageHeader from "../components/PageHeader.vue";
import StatusBadge from "../components/StatusBadge.vue";
import WorkflowCanvas from "../components/WorkflowCanvas.vue";
import type { JsonObject } from "../types";
const { t } = useI18n(),
  route = useRoute();
const task = useTask();
const id = String(route.params.id);
const content = ref<JsonObject>(),
  showContent = ref(false);
const agents = useQuery({ queryKey: ["inventory"], queryFn: inventory });
const query = useQuery({
  queryKey: ["run", id],
  queryFn: async () => {
    if (route.query.kind === "mock")
      return workflow("GET", "/simulations/" + id);
    try {
      return await workflow("GET", "/runs/" + id);
    } catch (error: any) {
      if (![400, 404].includes(error.response?.status)) throw error;
      if (route.query.agent === "support-request")
        return request("GET", "/application/runs/" + id + "/result");
      const run = await request("GET", "/runs/" + id);
      const events = await request("GET", "/runs/" + id + "/events");
      return { ...run, events: events.events };
    }
  },
});
const calls = useQuery({
  enabled: route.query.kind !== "mock",
  queryKey: ["tool-calls", id],
  queryFn: () => workflow("GET", "/runs/" + id + "/tool-calls"),
});
const toolCalls = computed(() =>
  route.query.kind === "mock"
    ? query.data.value?.content?.result?.tool_calls || []
    : calls.data.value?.calls || [],
);
async function showCall(invocation: string) {
  await task.run(async () => {
    content.value = await workflow(
      "GET",
      `/runs/${id}/tool-calls/${invocation}/content`,
    );
    showContent.value = true;
  }, false);
}
async function transcript() {
  await task.run(async () => {
    content.value = await request("GET", "/runs/" + id + "/transcript");
    showContent.value = true;
  }, false);
}
</script>
<template>
  <PageHeader :title="t('runDetail')"
    ><RouterLink to="/activity"
      ><NeButton>{{ t("back") }}</NeButton></RouterLink
    ><StatusBadge v-if="query.data.value" :status="query.data.value.status"
  /></PageHeader>
  <NeInlineNotification
    v-if="query.isError.value || task.error.value"
    kind="error"
    :title="task.error.value || t('error.request_failed')"
    class="mb-6"
  />
  <template v-if="query.data.value"
    ><div class="grid gap-6 xl:grid-cols-2">
      <section class="nv-panel space-y-5">
        <h2>{{ t("transcript") }}</h2>
        <div
          v-for="(m, index) in query.data.value.content?.messages || []"
          :key="index"
          class="rounded-md bg-gray-100 p-4 dark:bg-gray-700"
        >
          <p class="nv-muted text-xs">{{ m.role }}</p>
          <p class="mt-2 whitespace-pre-wrap">{{ m.text }}</p>
        </div>
        <p v-if="!query.data.value.content?.messages?.length" class="nv-muted">
          {{ t("contentUnavailable") }}
        </p>
        <NeButton
          v-if="
            ['available', 'partial', 'truncated'].includes(
              query.data.value.transcript_state,
            )
          "
          @click="transcript"
          >{{ t("open") }}</NeButton
        >
      </section>
      <section class="nv-panel space-y-5">
        <h2>{{ t("trace") }}</h2>
        <p class="nv-muted">
          {{ query.data.value.agent_id
          }}<span v-if="query.data.value.version">
            · v{{ query.data.value.version }}</span
          >
        </p>
        <ol class="space-y-3">
          <li
            v-for="(step, index) in query.data.value.steps ||
            query.data.value.trace ||
            []"
            :key="index"
            class="rounded-md bg-gray-100 p-3 dark:bg-gray-700"
          >
            {{
              query.data.value.definition?.nodes.find(
                (n: any) => n.id === step.node_id,
              )?.name || step.node_id
            }}
            · {{ step.outcome || step.status }}
            <span class="nv-muted">{{ step.duration_ms }} ms</span>
          </li>
        </ol>
        <RouterLink
          v-if="query.data.value.agent_id"
          :to="'/agents/' + query.data.value.agent_id + '/general'"
          ><NeButton>{{ t("open") }} {{ t("agents") }}</NeButton></RouterLink
        >
      </section>
    </div>
    <section class="nv-panel mt-6 space-y-4">
      <h2>{{ t("toolCalls") }}</h2>
      <div
        v-for="(call, index) in toolCalls"
        :key="call.invocation_id || index"
        class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 py-3 dark:border-gray-600"
      >
        <div>
          <p>
            {{
              agents.data.value?.tools.find(
                (tool) => tool.tool_id === call.tool_id,
              )?.draft.name || call.tool_id
            }}
            · v{{ call.version }}
          </p>
          <p class="nv-muted mt-1 text-xs">
            {{ t(call.mode === "conversation" ? "autonomous" : "explicit") }} ·
            {{ call.duration_ms || 0 }} ms
          </p>
        </div>
        <StatusBadge :status="call.state" /><NeButton
          v-if="call.content_available"
          @click="showCall(call.invocation_id)"
          >{{ t("open") }}</NeButton
        >
      </div>
      <p v-if="!toolCalls.length" class="nv-muted">
        {{ t("contentUnavailable") }}
      </p>
      <NeExpandable v-if="query.data.value.events" :label="t('trace')">
        <pre class="overflow-auto whitespace-pre-wrap text-xs">{{
          JSON.stringify(query.data.value.events, null, 2)
        }}</pre>
      </NeExpandable>
    </section>
    <section
      v-if="query.data.value.definition && agents.data.value"
      class="mt-6"
    >
      <WorkflowCanvas
        :model-value="query.data.value.definition"
        :inventory="agents.data.value"
        :readonly="true"
        :trace="query.data.value.steps || query.data.value.trace"
      />
    </section>
  </template>
  <NeModal
    :visible="showContent"
    :title="t('result')"
    :close-aria-label="t('close')"
    :cancel-label="t('close')"
    @close="
      showContent = false;
      content = undefined;
    "
  >
    <pre class="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{{
      JSON.stringify(content, null, 2)
    }}</pre>
  </NeModal>
</template>
