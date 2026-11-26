import type { TraceEvent } from "./types";

export function formatNumber(
  value: number,
  locale = "en",
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat(dateLocale(locale), {
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(part: number, total: number, locale = "en") {
  return new Intl.NumberFormat(dateLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(total ? part / total : 0);
}

export function duration(
  value: number | null | undefined,
  locale = "en",
): string {
  if (value == null) return "—";
  return value < 1000
    ? `${formatNumber(Math.round(value), locale)} ms`
    : `${formatNumber(value / 1000, locale, 2)} s`;
}

/** Phone numbers are shown exactly as stored; older runs have none. */
export function phoneNumber(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "—";
}

function dateLocale(locale: string): string {
  return locale === "en" ? "en-GB" : locale;
}

function parseUtc(value: string): Date {
  return new Date(
    value.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? "" : "Z"),
  );
}

export function formatDateTime(value: string, locale: string): string {
  const date = parseUtc(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(dateLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTime(value: string, locale: string): string {
  const date = parseUtc(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(dateLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDay(
  value: string,
  locale: string,
  month = false,
): string {
  const date = parseUtc(value + " 00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(dateLocale(locale), {
    timeZone: "UTC",
    ...(month ? {} : { day: "numeric" }),
    month: month ? "long" : "short",
    year: "numeric",
  });
}

/** Collapse start/end observations without losing parent or first-observed order. */
export function timeline(events: TraceEvent[]): TraceEvent[] {
  const spans = new Map<string, TraceEvent>();
  const result: TraceEvent[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.event_id)) continue;
    seen.add(event.event_id);
    if (event.span_id) {
      const existing = spans.get(event.span_id);
      if (existing) {
        if (
          event.event_type === "trace_started" &&
          existing.event_type === "trace_finished"
        ) {
          existing.elapsed_ms = event.elapsed_ms;
          existing.parent_span_id ||= event.parent_span_id;
        } else {
          const started = existing.elapsed_ms;
          Object.assign(existing, event, { elapsed_ms: started });
        }
      } else {
        const entry = { ...event };
        if (
          event.event_type === "trace_finished" &&
          event.elapsed_ms != null &&
          event.duration_ms != null
        ) {
          entry.elapsed_ms = Math.max(0, event.elapsed_ms - event.duration_ms);
        }
        spans.set(event.span_id, entry);
        result.push(entry);
      }
    } else result.push({ ...event });
  }
  return result.sort(
    (a, b) => (a.elapsed_ms ?? Infinity) - (b.elapsed_ms ?? Infinity),
  );
}

type Translate = (key: string, named?: Record<string, unknown>) => string;
type Exists = (key: string) => boolean;
function described(text: string, code: string) {
  return text ? text + " (" + code + ")" : code;
}
/** Readable text of a run error code, or null when the code is unknown. */
export function runErrorReason(
  code: string,
  t: Translate,
  te: Exists,
): string | null {
  if (te("monitoring.runErrors." + code))
    return t("monitoring.runErrors." + code);
  const http = /^provider_http_([0-9]+)$/.exec(code);
  if (http)
    return t("monitoring.errorPatterns.providerHttp", { status: http[1] });
  const hangup = /^provider_hangup_([0-9]+)$/.exec(code);
  if (hangup)
    return t("monitoring.errorPatterns.providerHangup", { cause: hangup[1] });
  const setup = /^setup_([a-z_]+)_failed$/.exec(code);
  if (setup) {
    const phase =
      setup[1] === "tool_catalog"
        ? t("monitoring.errorPatterns.toolCatalog")
        : setup[1] === "run_storage"
          ? t("monitoring.errorPatterns.runStorage")
          : te("monitoring.phasesMap." + setup[1])
            ? t("monitoring.phasesMap." + setup[1])
            : setup[1];
    return t("monitoring.errorPatterns.setupFailed", { phase });
  }
  const consultation = /^consultation_([a-z]+)_(failed|timeout)$/.exec(code);
  if (consultation && te("monitoring.consultationStages." + consultation[1]))
    return t(
      consultation[2] === "failed"
        ? "monitoring.errorPatterns.consultationFailed"
        : "monitoring.errorPatterns.consultationTimeout",
      { stage: t("monitoring.consultationStages." + consultation[1]) },
    );
  return null;
}
export function runErrorText(code: string, t: Translate, te: Exists): string {
  const reason = runErrorReason(code, t, te);
  return reason ? described(reason, code) : code;
}
export function providerCodeText(code: string, t: Translate, te: Exists) {
  for (const group of ["runDetail.providerCodes.", "monitoring.providerCodes."])
    if (te(group + code)) return described(t(group + code), code);
  return code;
}
