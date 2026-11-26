import { describe, expect, it } from "vitest";
import {
  duration,
  formatPercent,
  phoneNumber,
  timeline,
} from "../src/monitoring";
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
    expect(duration(2500)).toBe("2.5 s");
  });
  it("formats numbers for the language of the interface", () => {
    expect(duration(2500, "it")).toBe("2,5 s");
    expect(duration(1234567, "it")).toBe("1234,57 s");
    expect(formatPercent(1, 3, "en")).toBe("33%");
    expect(formatPercent(0, 0, "it")).toBe("0%");
  });
  it("shows phone numbers as stored and a dash when absent", () => {
    expect(phoneNumber("+39 0721 405500")).toBe("+39 0721 405500");
    expect(phoneNumber(null)).toBe("—");
    expect(phoneNumber("")).toBe("—");
    expect(phoneNumber(undefined)).toBe("—");
  });
});
