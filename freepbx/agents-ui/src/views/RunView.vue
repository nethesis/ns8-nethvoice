<script setup lang="ts">
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeInlineNotification,
  NeSkeleton,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import type { Run } from "../types";
const { t } = useI18n(),
  route = useRoute();
const query = useQuery({
  queryKey: ["run", route.params.id],
  queryFn: () =>
    request<Run>("GET", "/runs/" + encodeURIComponent(String(route.params.id))),
});
</script>
<template>
  <PageHeader :title="t('runDetails')"
    ><RouterLink to="/activity"
      ><NeButton>{{ t("back") }}</NeButton></RouterLink
    ><NeButton @click="query.refetch()">{{
      t("refresh")
    }}</NeButton></PageHeader
  >
  <NeSkeleton v-if="query.isLoading.value" class="h-48" />
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
  />
  <div v-if="query.data.value" class="nv-panel space-y-5">
    <RouterLink
      :to="'/agents/' + query.data.value.agent_id"
      class="text-primary-700"
      >{{ query.data.value.agent_id }}</RouterLink
    >
    <p>
      {{ t("publishedVersion") }}: {{ query.data.value.workflow_version }} ·
      {{ t("runOutcomes." + query.data.value.outcome) }}
    </p>
    <p>
      {{ t("startedAt") }}: {{ query.data.value.started_at }} ·
      {{ t("endedAt") }}: {{ query.data.value.ended_at || "—" }}
    </p>
    <p v-if="query.data.value.error_code">
      {{ t("errorCode") }}: {{ query.data.value.error_code }}
    </p>
    <ol class="space-y-4">
      <li
        v-for="event in query.data.value.events || []"
        :key="event.event_id"
        class="border-l-2 border-primary-500 pl-4"
      >
        <p>{{ t("runEvents." + event.event_type) }}</p>
        <p v-if="event.tool_id">
          {{ t("toolNames." + event.tool_id.replaceAll(".", "_"))
          }}<span v-if="event.destination_id">
            · {{ event.destination_id }}</span
          >
        </p>
        <p class="nv-muted text-sm">
          {{ event.occurred_at
          }}<span v-if="event.error_code"> · {{ event.error_code }}</span>
        </p>
        <p v-if="event.result_count != null">
          {{ t("directoryMatches", { count: event.result_count }) }}
        </p>
      </li>
    </ol>
    <section class="space-y-4">
      <h2>{{ t("debugTranscription") }}</h2>
      <p class="nv-muted">{{ t("debugTranscriptHelp") }}</p>
      <p v-if="!query.data.value.transcripts?.length" class="nv-muted">
        {{ t("noDebugTranscript") }}
      </p>
      <ol class="space-y-4">
        <li
          v-for="(turn, index) in query.data.value.transcripts || []"
          :key="index"
          class="border-l-2 border-primary-500 pl-4"
        >
          <p class="font-semibold">
            {{ t("transcriptRole." + turn.role) }} · {{ turn.occurred_at }}
          </p>
          <p class="whitespace-pre-wrap break-words">{{ turn.text }}</p>
          <p v-if="turn.interrupted || turn.truncated" class="nv-muted text-sm">
            {{ t("partialTranscript") }}
          </p>
        </li>
      </ol>
    </section>
  </div>
</template>
