import type { TraceEvent } from "./types";

export function duration(value: number | null | undefined): string {
  if (value == null) return "—";
  return value < 1000
    ? `${Math.round(value)} ms`
    : `${Number((value / 1000).toFixed(2))} s`;
}

function dateLocale(locale: string): string {
  return locale === "en" ? "en-GB" : locale;
}

function parseUtc(value: string): Date {
  return new Date(
    value.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? "" : "Z"),
  );
}

export function formatLocal(value: string, locale: string): string {
  const date = parseUtc(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(dateLocale(locale), {
    timeZoneName: "short",
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
    timeZoneName: "short",
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
export function runErrorText(code: string, t: Translate, te: Exists): string {
  if (te("monitoring.runErrors." + code))
    return described(t("monitoring.runErrors." + code), code);
  const http = /^provider_http_([0-9]+)$/.exec(code);
  if (http)
    return described(
      t("monitoring.errorPatterns.providerHttp", { status: http[1] }),
      code,
    );
  const hangup = /^provider_hangup_([0-9]+)$/.exec(code);
  if (hangup)
    return described(
      t("monitoring.errorPatterns.providerHangup", { cause: hangup[1] }),
      code,
    );
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
    return described(
      t("monitoring.errorPatterns.setupFailed", { phase }),
      code,
    );
  }
  const consultation = /^consultation_([a-z]+)_(failed|timeout)$/.exec(code);
  if (consultation && te("monitoring.consultationStages." + consultation[1]))
    return described(
      t(
        consultation[2] === "failed"
          ? "monitoring.errorPatterns.consultationFailed"
          : "monitoring.errorPatterns.consultationTimeout",
        { stage: t("monitoring.consultationStages." + consultation[1]) },
      ),
      code,
    );
  return code;
}
export function providerCodeText(code: string, t: Translate, te: Exists) {
  return te("monitoring.providerCodes." + code)
    ? described(t("monitoring.providerCodes." + code), code)
    : code;
}
