import type { TraceEvent } from "./types";

export function duration(value: number | null | undefined): string {
  if (value == null) return "—";
  return value < 1000
    ? `${Math.round(value)} ms`
    : `${(value / 1000).toFixed(2)} s`;
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
