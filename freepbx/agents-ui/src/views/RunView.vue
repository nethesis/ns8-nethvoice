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
import {
  faArrowUpRightFromSquare,
  faArrowsRotate,
  faChevronDown,
  faChevronUp,
  faPlug,
  faStopwatch,
  faVolumeHigh,
} from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "vue-i18n";
import { useLoadError } from "../composables/useLoadError";
import { request } from "../api";
import PageHeader from "../components/PageHeader.vue";
import CounterCard from "../components/CounterCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import AppExpandable from "../components/AppExpandable.vue";
import type { Run, TraceEvent } from "../types";
import {
  duration,
  formatDateTime,
  formatNumber,
  formatTime,
  phoneNumber,
  providerCodeText,
  runErrorReason,
  runErrorText,
  timeline,
} from "../monitoring";
const { t, te, locale } = useI18n(),
  loadError = useLoadError(),
  route = useRoute();
const lang = computed(() => String(locale.value));
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
const events = computed(
  () => traceQuery.data.value?.pages.flatMap((page) => page.items) || [],
);
type Phase = { event: TraceEvent; children: TraceEvent[] };
const phases = computed<Phase[]>(() => {
  const entries = timeline(events.value);
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
  const keys = [
    ...(event.phase ? ["monitoring.phasesMap." + event.phase] : []),
    "runDetail.events." + event.event_type,
    "runEvents." + event.event_type,
  ];
  const key = keys.find((item) => te(item));
  if (key) return t(key);
  // An event of a newer service: readable, never the raw identifier.
  const text = (event.phase || event.event_type).replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function start(event: TraceEvent) {
  return event.elapsed_ms != null
    ? "+" + duration(event.elapsed_ms, lang.value)
    : formatTime(event.occurred_at, lang.value);
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
    event.error_code ? runErrorText(event.error_code, t, te) : "",
    event.provider_code ? providerCodeText(event.provider_code, t, te) : "",
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
// The outcome is the one stored by the backend: a call that reached the
// fallback destination is reported as such, never as failed.
const notice = computed(() => {
  const value = run.value;
  if (!value?.error_code) return null;
  const reason =
    runErrorReason(value.error_code, t, te) || t("runDetail.unknownReason");
  const sentence = t("runDetail.reasonSentence", { reason });
  if (value.outcome === "fallback")
    return {
      kind: "warning" as const,
      title: t("runDetail.fallbackTitle"),
      description: t("runDetail.fallbackDescription", { reason }),
    };
  if (value.outcome === "failed")
    return {
      kind: "error" as const,
      title: t("runDetail.failedTitle"),
      description: sentence,
    };
  if (value.outcome === "interrupted")
    return {
      kind: "warning" as const,
      title: t("runDetail.interruptedTitle"),
      description: sentence,
    };
  return {
    kind: "info" as const,
    title: t("runDetail.endedTitle"),
    description: sentence,
  };
});
const providerWarnings = computed(() => [
  ...new Set(
    events.value
      .filter((event) => event.event_type === "provider_warning")
      .map((event) => String(event.provider_code || "")),
  ),
]);
function warningText(code: string) {
  return te("runDetail.providerCodes." + code)
    ? t("runDetail.providerCodes." + code)
    : te("monitoring.providerCodes." + code)
      ? t("monitoring.providerCodes." + code)
      : code;
}
const summary = computed(() => {
  const value = run.value;
  if (!value) return [];
  return [
    { id: "agent", label: t("runDetail.agent"), value: "" },
    {
      id: "caller",
      label: t("runDetail.caller"),
      value: phoneNumber(value.caller_number),
    },
    {
      id: "called",
      label: t("runDetail.calledNumber"),
      value: phoneNumber(value.called_number),
    },
    { id: "outcome", label: t("runDetail.outcome"), value: "" },
    {
      id: "started",
      label: t("runDetail.started"),
      value: formatDateTime(value.started_at, lang.value),
    },
    {
      id: "ended",
      label: t("runDetail.ended"),
      value: value.ended_at ? formatDateTime(value.ended_at, lang.value) : "—",
    },
    {
      id: "duration",
      label: t("runDetail.duration"),
      value: duration(value.duration_ms, lang.value),
    },
    {
      id: "provider",
      label: t("runDetail.voiceProvider"),
      value: providers[value.provider || ""] || value.provider || "—",
    },
    {
      id: "model",
      label: t("runDetail.voiceModel"),
      value: value.model || "—",
    },
    {
      id: "version",
      label: t("runDetail.publishedVersion"),
      value: String(value.workflow_version),
    },
    {
      id: "publisher",
      label: t("runDetail.publishedBy"),
      value: value.published_by || "—",
    },
    { id: "run", label: t("runDetail.runId"), value: value.run_id },
  ];
});
const performance = computed(() =>
  (
    [
      ["duration_ms", "run_duration", faStopwatch],
      ["setup_duration_ms", "setup_duration", faPlug],
      ["first_output_ms", "first_output", faVolumeHigh],
    ] as const
  ).map(([field, metric, icon]) => ({
    id: field,
    label: t("monitoringPage.metrics." + metric),
    value: duration(run.value?.[field], lang.value),
    icon,
    tooltip:
      metric === "first_output" ? t("monitoringPage.firstAnswerHelp") : "",
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
        time: formatTime(item.occurred_at, lang.value),
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
const diagnosticsOpen = ref(false);
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
    :title="t('runDetail.title')"
    :description="
      run
        ? (run.caller_number ? run.caller_number + ' · ' : '') +
          formatDateTime(run.started_at, lang)
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
        ><FontAwesomeIcon :icon="faArrowsRotate" aria-hidden="true" /></template
      >{{ t("refresh") }}</NeButton
    >
  </PageHeader>
  <NeSkeleton v-if="query.isLoading.value" :lines="8" />
  <NeInlineNotification
    v-if="query.isError.value"
    kind="error"
    :title="loadError(query.error.value)"
  />
  <div v-if="run" class="flex flex-col gap-12">
    <div
      v-if="notice || providerWarnings.length || run.parent_run_id"
      class="flex max-w-3xl flex-col gap-4"
    >
      <NeInlineNotification
        v-if="notice"
        data-testid="run-outcome-notice"
        :kind="notice.kind"
        :title="notice.title"
        :description="notice.description"
        :show-details-label="t('runDetail.showDetails')"
        ><template #details
          ><span class="font-mono text-xs">{{
            t("runDetail.errorCode", { code: run.error_code })
          }}</span></template
        ></NeInlineNotification
      >
      <NeInlineNotification
        v-for="code in providerWarnings"
        :key="code"
        data-testid="run-provider-warning"
        kind="info"
        :title="t('runDetail.providerWarningTitle')"
        :description="warningText(code)"
      />
      <RouterLink
        v-if="run.parent_run_id"
        :to="'/activity/' + run.parent_run_id"
        class="text-primary-700 dark:text-primary-500 self-start font-medium hover:underline"
        >{{ t("callerRun") }}</RouterLink
      >
    </div>
    <NeCard data-testid="run-summary">
      <dl
        class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div v-for="item in summary" :key="item.id" class="flex flex-col gap-1">
          <dt class="text-tertiary-neutral text-sm">{{ item.label }}</dt>
          <dd class="text-primary-neutral wrap-break-word">
            <RouterLink
              v-if="item.id === 'agent'"
              :to="'/agents/' + run.agent_id"
              class="text-primary-700 dark:text-primary-500 hover:underline"
              >{{ run.agent_name || run.agent_id }}</RouterLink
            ><StatusBadge
              v-else-if="item.id === 'outcome'"
              :status="run.outcome"
            /><template v-else>{{ item.value }}</template>
          </dd>
        </div>
      </dl>
      <a
        v-if="run.call_record_url"
        class="text-primary-700 dark:text-primary-500 mt-6 inline-flex items-center gap-2 font-medium hover:underline"
        :href="run.call_record_url"
        target="_blank"
        rel="noopener"
        ><FontAwesomeIcon
          :icon="faArrowUpRightFromSquare"
          class="size-4"
          aria-hidden="true"
        />{{ t("runDetail.callRecord") }}</a
      >
    </NeCard>
    <section v-if="transcript" data-testid="run-transcription">
      <NeHeading tag="h5">{{ t("runDetail.transcription") }}</NeHeading>
      <p class="text-muted mt-1 mb-3 max-w-2xl">
        {{ t("runDetail.transcriptionHelp") }}
      </p>
      <NeTextArea
        :model-value="transcript"
        readonly
        :rows="12"
        :aria-label="t('runDetail.transcription')"
      />
    </section>
    <section data-testid="run-diagnostics">
      <AppExpandable
        v-model="diagnosticsOpen"
        :label="t('monitoringPage.diagnostics')"
      >
        <div class="mt-6 flex flex-col gap-12">
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
            <p v-if="run.adapter" class="text-muted mt-3">
              {{ t("runDetail.adapter") }}:
              {{ adapters[run.adapter] || run.adapter }}
            </p>
          </section>
          <section>
            <NeHeading tag="h5">{{ t("monitoring.timeline") }}</NeHeading>
            <p class="text-muted mt-1 mb-3 max-w-2xl">
              {{ t("monitoring.timelineHelp") }}
            </p>
            <NeInlineNotification
              v-if="partial"
              data-testid="trace-partial"
              class="mb-3 max-w-3xl"
              kind="warning"
              :title="t('monitoring.partialTrace')"
              :description="t('monitoring.partialHelp')"
            />
            <NeInlineNotification
              v-if="traceQuery.isError.value"
              class="mb-3 max-w-3xl"
              kind="error"
              :title="loadError(traceQuery.error.value)"
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
                    ><span class="sr-only">{{
                      t("expand")
                    }}</span></NeTableHeadCell
                  >
                  <NeTableHeadCell>{{ t("monitoring.phase") }}</NeTableHeadCell>
                  <NeTableHeadCell>{{ t("monitoring.start") }}</NeTableHeadCell>
                  <NeTableHeadCell>{{
                    t("monitoring.duration")
                  }}</NeTableHeadCell>
                  <NeTableHeadCell>{{ t("state") }}</NeTableHeadCell>
                </NeTableHead>
                <NeTableBody>
                  <template v-for="phase in phases" :key="phase.event.event_id">
                    <NeTableRow>
                      <NeTableCell data-label="" class="w-px pr-0!">
                        <button
                          v-if="phase.children.length"
                          type="button"
                          class="text-tertiary-neutral hover:text-primary-neutral focus-visible:outline-primary-500 flex size-6 cursor-pointer items-center justify-center rounded-sm focus-visible:outline-2"
                          :aria-expanded="
                            expanded.includes(phase.event.event_id)
                              ? 'true'
                              : 'false'
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
                                ? faChevronUp
                                : faChevronDown
                            "
                            class="size-4"
                            aria-hidden="true"
                          />
                        </button>
                      </NeTableCell>
                      <NeTableCell :data-label="t('monitoring.phase')">
                        <p class="text-primary-neutral">
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
                      <NeTableCell
                        :data-label="t('monitoring.start')"
                        class="whitespace-nowrap"
                        >{{ start(phase.event) }}</NeTableCell
                      >
                      <NeTableCell
                        :data-label="t('monitoring.duration')"
                        class="whitespace-nowrap"
                        >{{
                          phase.event.duration_ms != null
                            ? duration(phase.event.duration_ms, lang)
                            : "-"
                        }}</NeTableCell
                      >
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
                        <NeTableCell
                          :data-label="t('monitoring.start')"
                          class="whitespace-nowrap"
                          >{{ start(child) }}</NeTableCell
                        >
                        <NeTableCell
                          :data-label="t('monitoring.duration')"
                          class="whitespace-nowrap"
                          >{{
                            child.duration_ms != null
                              ? duration(child.duration_ms, lang)
                              : "-"
                          }}</NeTableCell
                        >
                        <NeTableCell :data-label="t('state')"
                          ><StatusBadge
                            v-if="child.status"
                            :status="child.status"
                        /></NeTableCell>
                      </NeTableRow>
                    </template>
                  </template>
                  <NeTableRow
                    v-if="!traceQuery.isLoading.value && !phases.length"
                  >
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
                    formatNumber(value, lang) +
                    (key === 'live_seconds' ? ' s' : '')
                  "
                />
              </div>
            </template>
          </section>
        </div>
      </AppExpandable>
    </section>
  </div>
</template>
