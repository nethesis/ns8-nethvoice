<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useQuery, useInfiniteQuery } from "@tanstack/vue-query";
import {
  NeButton,
  NeInlineNotification,
  NeSkeleton,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import type { Run, TraceEvent } from "../types";
import { duration, timeline } from "../monitoring";
const { t } = useI18n(),
  route = useRoute();
const query = useQuery({
  queryKey: ["run", computed(() => route.params.id)],
  queryFn: () =>
    request<Run>("GET", "/runs/" + encodeURIComponent(String(route.params.id))),
  refetchInterval: (query) =>
    query.state.data?.outcome === "running" ? 5000 : false,
});
const traceQuery = useInfiniteQuery({
  queryKey: ["run-trace", computed(() => route.params.id)],
  initialPageParam: null as string | null,
  queryFn: ({ pageParam }) =>
    request<{ items: TraceEvent[]; next_cursor: string | null }>(
      "GET",
      "/runs/" + encodeURIComponent(String(route.params.id)) + "/trace",
      undefined,
      pageParam ? { cursor: pageParam } : {},
    ),
  getNextPageParam: (last) => last.next_cursor || undefined,
  enabled: computed(() => !!query.data.value),
  refetchInterval: () =>
    query.data.value?.outcome === "running" ? 5000 : false,
});
const entries = computed(() =>
  timeline(traceQuery.data.value?.pages.flatMap((page) => page.items) || []),
);
function refresh() {
  void query.refetch();
  void traceQuery.refetch();
}
const partial = computed(
  () =>
    query.data.value?.trace_status === "partial" ||
    query.data.value?.incomplete,
);
</script>
<template>
  <PageHeader :title="t('runDetails')"
    ><RouterLink to="/activity"
      ><NeButton>{{ t("back") }}</NeButton></RouterLink
    ><NeButton @click="refresh">{{ t("refresh") }}</NeButton></PageHeader
  >
  <NeSkeleton v-if="query.isLoading.value" class="h-48" />
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
  />
  <div v-if="query.data.value" class="nv-panel space-y-5">
    <RouterLink
      v-if="query.data.value.parent_run_id"
      :to="'/activity/' + query.data.value.parent_run_id"
      class="text-primary-700"
      >{{ t("callerRun") }}</RouterLink
    >
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
    <p v-if="query.data.value.provider" class="nv-muted">
      {{ query.data.value.provider }} · {{ query.data.value.adapter }} ·
      {{ query.data.value.model }}
    </p>
    <NeInlineNotification
      v-if="partial"
      data-testid="trace-partial"
      kind="warning"
      :title="t('monitoring.partialTrace')"
      :description="t('monitoring.partialHelp')"
    />
    <dl class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="metric in [
          'duration_ms',
          'setup_duration_ms',
          'first_output_ms',
        ] as const"
        :key="metric"
      >
        <dt class="nv-muted">{{ t("monitoring.runMetrics." + metric) }}</dt>
        <dd class="text-lg font-semibold">
          {{ duration(query.data.value[metric]) }}
        </dd>
      </div>
    </dl>
    <p class="nv-muted text-sm">{{ t("monitoring.audioLimit") }}</p>
    <section class="space-y-4">
      <h2>{{ t("monitoring.timeline") }}</h2>
      <NeInlineNotification
        v-if="traceQuery.isError.value"
        kind="error"
        :title="t('error.request_failed')"
      />
      <ol data-testid="trace-timeline" class="space-y-4">
        <li
          v-for="event in entries"
          :key="event.event_id"
          class="min-w-0 border-l-2 border-primary-500 pl-4"
          :class="{ 'ml-4': event.parent_span_id }"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-semibold">
              {{
                event.phase
                  ? t("monitoring.phasesMap." + event.phase)
                  : t("runEvents." + event.event_type)
              }}
            </p>
            <span v-if="event.status" class="nv-muted text-sm">{{
              t("monitoring.status." + event.status)
            }}</span>
          </div>
          <p class="nv-muted text-sm">
            {{
              event.elapsed_ms != null
                ? "+" + duration(event.elapsed_ms)
                : event.occurred_at + " UTC"
            }}<span v-if="event.duration_ms != null">
              · {{ t("monitoring.duration") }}:
              {{ duration(event.duration_ms) }}</span
            >
          </p>
          <p v-if="event.tool_id" class="break-words">
            {{ t("toolNames." + event.tool_id.replaceAll(".", "_"))
            }}<span v-if="event.destination_id">
              · {{ event.destination_id }}</span
            >
          </p>
          <p
            v-if="event.http_status || event.error_code || event.provider_code"
            class="break-words text-sm"
          >
            {{
              [
                event.http_status ? "HTTP " + event.http_status : "",
                event.error_code,
                event.provider_code,
              ]
                .filter(Boolean)
                .join(" · ")
            }}
          </p>
          <p v-if="event.result_count != null">
            {{ t("directoryMatches", { count: event.result_count }) }}
          </p>
        </li>
      </ol>
      <NeButton
        v-if="traceQuery.hasNextPage.value"
        :loading="traceQuery.isFetchingNextPage.value"
        @click="traceQuery.fetchNextPage()"
        >{{ t("monitoring.loadMore") }}</NeButton
      >
    </section>
    <section data-testid="trace-usage" class="space-y-3">
      <h2>{{ t("monitoring.usage") }}</h2>
      <p class="nv-muted text-sm">{{ t("monitoring.usageHelp") }}</p>
      <p v-if="!query.data.value.usage" class="nv-muted">
        {{ t("monitoring.usageUnavailable") }}
      </p>
      <template v-else
        ><p v-if="!query.data.value.usage_complete" class="nv-muted">
          {{ t("monitoring.usagePartial") }}
        </p>
        <dl class="grid gap-3 md:grid-cols-2">
          <div v-for="(value, key) in query.data.value.usage" :key="key">
            <dt class="nv-muted">{{ t("monitoring.usageKeys." + key) }}</dt>
            <dd class="font-semibold">{{ value }}</dd>
          </div>
        </dl></template
      >
    </section>
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
