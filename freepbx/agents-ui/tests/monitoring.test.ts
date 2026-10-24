import { describe, expect, it } from "vitest";
import { duration, timeline } from "../src/monitoring";
import type { TraceEvent } from "../src/types";

const start: TraceEvent = {
  event_id: "start",
  span_id: "span",
  event_type: "trace_started",
  phase: "tool",
  status: "running",
  elapsed_ms: 100,
  occurred_at: "synthetic",
};
const end: TraceEvent = {
  ...start,
  event_id: "end",
  event_type: "trace_finished",
  status: "completed",
  elapsed_ms: 500,
  duration_ms: 400,
};
describe("monitoring presentation", () => {
  it("collapses and deduplicates a span while keeping its start", () => {
    const result = timeline([start, end, end]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      elapsed_ms: 100,
      duration_ms: 400,
      status: "completed",
    });
    expect(start.status).toBe("running");
  });
  it("preserves completion when UTC observations arrive in reverse order", () => {
    expect(timeline([end, start])[0]).toMatchObject({
      elapsed_ms: 100,
      duration_ms: 400,
      status: "completed",
    });
  });
  it("shows unavailable values distinctly from zero", () => {
    expect(duration(null)).toBe("—");
    expect(duration(0)).toBe("0 ms");
    expect(duration(2500)).toBe("2.50 s");
  });
});
