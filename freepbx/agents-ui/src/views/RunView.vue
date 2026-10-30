<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useQuery, useInfiniteQuery } from "@tanstack/vue-query";
import {
  NeBadgeV2,
  NeButton,
  NeCard,
  NeHeading,
  NeInlineNotification,
  NeSkeleton,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextArea,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import { request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import CounterCard from "../components/CounterCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import type { Run, TraceEvent } from "../types";
import { duration, formatTime, formatUtc, timeline } from "../monitoring";
const { t, te, locale } = useI18n(),
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
type Phase = { event: TraceEvent; children: TraceEvent[] };
const phases = computed<Phase[]>(() => {
  const entries = timeline(
    traceQuery.data.value?.pages.flatMap((page) => page.items) || [],
  );
  const spans = new Map<string, Phase>();
  const roots: Phase[] = [];
  for (const event of entries) {
    const parent = event.parent_span_id
      ? spans.get(event.parent_span_id)
      : undefined;
    if (parent) {
      parent.children.push(event);
      continue;
    }
    const phase = { event, children: [] };
    if (event.span_id) spans.set(event.span_id, phase);
    roots.push(phase);
  }
  return roots;
});
const expanded = ref<string[]>([]);
function toggle(id: string) {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((value) => value !== id)
    : [...expanded.value, id];
}
function name(event: TraceEvent) {
  return event.phase
    ? t("monitoring.phasesMap." + event.phase)
    : te("runEvents." + event.event_type)
      ? t("runEvents." + event.event_type)
      : event.event_type;
}
function start(event: TraceEvent) {
  return event.elapsed_ms != null
    ? "+" + duration(event.elapsed_ms)
    : formatTime(event.occurred_at, String(locale.value));
}
function details(event: TraceEvent) {
  const lines: string[] = [];
  if (event.tool_id)
    lines.push(
      (te("toolNames." + event.tool_id.replaceAll(".", "_"))
        ? t("toolNames." + event.tool_id.replaceAll(".", "_"))
        : event.tool_id) +
        (event.destination_id ? " · " + event.destination_id : ""),
    );
  if (event.result_count != null)
    lines.push(t("directoryMatches", { count: event.result_count }));
  const error = [
    event.http_status ? "HTTP " + event.http_status : "",
    event.error_code,
    event.provider_code,
  ]
    .filter(Boolean)
    .join(" · ");
  if (error) lines.push(error);
  return lines;
}
const run = computed(() => query.data.value);
const providers: Record<string, string> = { openai: "OpenAI", grok: "Grok" };
const adapters = computed<Record<string, string>>(() => ({
  realtime: "Realtime",
  live: t("monitoring.liveSip"),
  live_ws: t("monitoring.liveWebSocket"),
}));
const summary = computed(() => {
  const value = run.value;
  if (!value) return [];
  return [
    { id: "agent", label: t("agentColumn"), value: "" },
    {
      id: "version",
      label: t("publishedVersion"),
      value: String(value.workflow_version),
    },
    {
      id: "started",
      label: t("startedAt"),
      value: formatUtc(value.started_at, String(locale.value)) + " UTC",
    },
    {
      id: "ended",
      label: t("endedAt"),
      value: value.ended_at
        ? formatUtc(value.ended_at, String(locale.value)) + " UTC"
        : "—",
    },
    {
      id: "provider",
      label: t("provider"),
      value: providers[value.provider || ""] || value.provider || "—",
    },
    {
      id: "adapter",
      label: t("monitoring.adapter"),
      value: adapters.value[value.adapter || ""] || value.adapter || "—",
    },
    { id: "model", label: t("voiceModel"), value: value.model || "—" },
    {
      id: "duration",
      label: t("monitoring.duration"),
      value: duration(value.duration_ms),
    },
    ...(value.error_code
      ? [{ id: "error", label: t("errorCode"), value: value.error_code }]
      : []),
  ];
});
const performance = computed(() =>
  (
    [
      ["duration_ms", "stopwatch"],
      ["setup_duration_ms", "plug"],
      ["first_output_ms", "volume-high"],
    ] as const
  ).map(([metric, icon]) => ({
    id: metric,
    label: t("monitoring.runMetrics." + metric),
    value: duration(run.value?.[metric]),
    icon,
    tooltip: metric === "first_output_ms" ? t("monitoring.audioLimit") : "",
  })),
);
const transcript = computed(() => {
  const turns: { role: string; time: string; text: string[] }[] = [];
  for (const item of run.value?.transcripts || []) {
    const last = turns[turns.length - 1];
    const text = item.text + (item.interrupted || item.truncated ? " […]" : "");
    if (last && last.role === item.role) last.text.push(text);
    else
      turns.push({
        role: item.role,
        time: formatTime(item.occurred_at, String(locale.value)),
        text: [text],
      });
  }
  return turns
    .map(
      (turn) =>
        t("transcriptRole." + turn.role) +
        " (" +
        turn.time +
        "):\n" +
        turn.text.join(" "),
    )
    .join("\n\n");
});
function refresh() {
  void query.refetch();
  void traceQuery.refetch();
}
const partial = computed(
  () => run.value?.trace_status === "partial" || run.value?.incomplete,
);
</script>
<template>
  <PageHeader
    :title="t('runDetails')"
    :description="
      run
        ? (run.agent_name || run.agent_id) +
          ' · ' +
          formatUtc(run.started_at, String(locale)) +
          ' UTC'
        : ''
    "
    back="/activity"
  >
    <template v-if="run" #badges
      ><StatusBadge :status="run.outcome" /><NeBadgeV2
        v-if="partial"
        kind="amber"
        >{{ t("monitoring.incomplete") }}</NeBadgeV2
      ></template
    >
    <NeButton
      kind="secondary"
      size="lg"
      :loading="query.isFetching.value || traceQuery.isFetching.value"
      @click="refresh"
      ><template #prefix
        ><FontAwesomeIcon icon="arrows-rotate" aria-hidden="true" /></template
      >{{ t("refresh") }}</NeButton
    >
  </PageHeader>
  <NeSkeleton v-if="query.isLoading.value" :lines="8" />
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="t('error.request_failed')"
  />
  <div v-if="run" class="flex flex-col gap-12">
    <NeCard>
      <dl
        class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div v-for="item in summary" :key="item.id" class="flex flex-col gap-1">
          <dt class="text-tertiary-neutral text-sm">{{ item.label }}</dt>
          <dd class="text-primary-neutral font-medium wrap-break-word">
            <RouterLink
              v-if="item.id === 'agent'"
              :to="'/agents/' + run.agent_id"
              class="hover:underline"
              >{{ run.agent_name || run.agent_id }}</RouterLink
            ><template v-else>{{ item.value }}</template>
          </dd>
        </div>
      </dl>
    </NeCard>
    <section>
      <NeHeading tag="h5" class="mb-3">{{
        t("monitoring.performance")
      }}</NeHeading>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <CounterCard
          v-for="metric in performance"
          :key="metric.id"
          :title="metric.label"
          :value="metric.value"
          :icon="metric.icon"
          :tooltip="metric.tooltip"
        />
      </div>
    </section>
    <section>
      <NeHeading tag="h5">{{ t("monitoring.timeline") }}</NeHeading>
      <p class="text-muted mt-1 mb-3 max-w-2xl">
        {{ t("monitoring.timelineHelp") }}
      </p>
      <NeInlineNotification
        v-if="partial"
        data-testid="trace-partial"
        class="mb-3"
        kind="warning"
        :title="t('monitoring.partialTrace')"
        :description="t('monitoring.partialHelp')"
      />
      <NeInlineNotification
        v-if="traceQuery.isError.value"
        class="mb-3"
        kind="error"
        :title="t('error.request_failed')"
      />
      <div data-testid="trace-timeline">
        <NeTable
          :aria-label="t('monitoring.timeline')"
          :loading="traceQuery.isLoading.value"
          :skeleton-columns="5"
          :skeleton-rows="6"
          card-breakpoint="xl"
        >
          <NeTableHead>
            <NeTableHeadCell class="w-px pr-0!"
              ><span class="sr-only">{{ t("expand") }}</span></NeTableHeadCell
            >
            <NeTableHeadCell>{{ t("monitoring.phase") }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t("monitoring.start") }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t("monitoring.duration") }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t("state") }}</NeTableHeadCell>
          </NeTableHead>
          <NeTableBody>
            <template v-for="phase in phases" :key="phase.event.event_id">
              <NeTableRow>
                <NeTableCell data-label="" class="w-px pr-0!">
                  <button
                    v-if="phase.children.length"
                    type="button"
                    class="text-tertiary-neutral hover:text-primary-neutral flex size-6 cursor-pointer items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-primary-500"
                    :aria-expanded="
                      expanded.includes(phase.event.event_id) ? 'true' : 'false'
                    "
                    :aria-label="
                      t(
                        expanded.includes(phase.event.event_id)
                          ? 'collapseItem'
                          : 'expandItem',
                        { name: name(phase.event) },
                      )
                    "
                    @click="toggle(phase.event.event_id)"
                  >
                    <FontAwesomeIcon
                      :icon="
                        expanded.includes(phase.event.event_id)
                          ? 'chevron-up'
                          : 'chevron-down'
                      "
                      class="size-4"
                      aria-hidden="true"
                    />
                  </button>
                </NeTableCell>
                <NeTableCell :data-label="t('monitoring.phase')">
                  <p class="text-primary-neutral font-medium">
                    {{ name(phase.event) }}
                  </p>
                  <p
                    v-for="line in details(phase.event)"
                    :key="line"
                    class="text-muted wrap-break-word"
                  >
                    {{ line }}
                  </p>
                </NeTableCell>
                <NeTableCell :data-label="t('monitoring.start')">{{
                  start(phase.event)
                }}</NeTableCell>
                <NeTableCell :data-label="t('monitoring.duration')">{{
                  phase.event.duration_ms != null
                    ? duration(phase.event.duration_ms)
                    : "-"
                }}</NeTableCell>
                <NeTableCell :data-label="t('state')"
                  ><StatusBadge
                    v-if="phase.event.status"
                    :status="phase.event.status"
                  /><template v-else>-</template></NeTableCell
                >
              </NeTableRow>
              <template v-if="expanded.includes(phase.event.event_id)">
                <NeTableRow
                  v-for="child in phase.children"
                  :key="child.event_id"
                >
                  <NeTableCell data-label="" class="w-px pr-0!" />
                  <NeTableCell :data-label="t('monitoring.phase')">
                    <p class="text-primary-neutral">{{ name(child) }}</p>
                    <p
                      v-for="line in details(child)"
                      :key="line"
                      class="text-muted wrap-break-word"
                    >
                      {{ line }}
                    </p>
                  </NeTableCell>
                  <NeTableCell :data-label="t('monitoring.start')">{{
                    start(child)
                  }}</NeTableCell>
                  <NeTableCell :data-label="t('monitoring.duration')">{{
                    child.duration_ms != null
                      ? duration(child.duration_ms)
                      : "-"
                  }}</NeTableCell>
                  <NeTableCell :data-label="t('state')"
                    ><StatusBadge v-if="child.status" :status="child.status"
                  /></NeTableCell>
                </NeTableRow>
              </template>
            </template>
            <NeTableRow v-if="!traceQuery.isLoading.value && !phases.length">
              <NeTableCell data-label="" />
              <NeTableCell :data-label="t('monitoring.phase')"
                ><span class="text-muted">{{
                  t("noResults")
                }}</span></NeTableCell
              >
            </NeTableRow>
          </NeTableBody>
        </NeTable>
      </div>
      <NeButton
        v-if="traceQuery.hasNextPage.value"
        kind="tertiary"
        class="mt-3"
        :loading="traceQuery.isFetchingNextPage.value"
        @click="traceQuery.fetchNextPage()"
        >{{ t("monitoring.loadMore") }}</NeButton
      >
    </section>
    <section data-testid="trace-usage">
      <NeHeading tag="h5">{{ t("monitoring.usage") }}</NeHeading>
      <p class="text-muted mt-1 mb-3 max-w-2xl">
        {{ t("monitoring.usageHelp") }}
      </p>
      <p v-if="!run.usage" class="text-muted">
        {{ t("monitoring.usageUnavailable") }}
      </p>
      <template v-else>
        <p v-if="!run.usage_complete" class="text-muted mb-3">
          {{ t("monitoring.usagePartial") }}
        </p>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <CounterCard
            v-for="(value, key) in run.usage"
            :key="key"
            :title="t('monitoring.usageKeys.' + key)"
            :value="
              value.toLocaleString(String(locale)) +
              (key === 'live_seconds' ? ' s' : '')
            "
          />
        </div>
      </template>
    </section>
    <section>
      <NeHeading tag="h5">{{ t("debugTranscription") }}</NeHeading>
      <p class="text-muted mt-1 mb-3 max-w-2xl">
        {{ t("debugTranscriptHelp") }}
      </p>
      <p v-if="!transcript" class="text-muted">
        {{ t("noDebugTranscript") }}
      </p>
      <NeTextArea
        v-else
        :model-value="transcript"
        readonly
        :rows="12"
        :aria-label="t('debugTranscription')"
      />
    </section>
  </div>
</template>
