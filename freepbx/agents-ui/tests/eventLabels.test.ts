import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { i18n } from "../src/i18n";

// The run events and phases the agent service can record.
const source = (file: string) =>
  readFileSync(
    new URL("../../../satellite/voice_agent/" + file, import.meta.url),
    "utf8",
  );
const words = (text: string) =>
  [...text.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
const monitoring = source("monitoring.py");
const base = monitoring.match(/^EVENTS = frozenset\(\(([\s\S]*?)\)\)\n/m)![1];
const consultation = monitoring.match(
  /'consultation_' \+ state for state in \(([^)]*)\)/,
)![1];
const events = [
  ...words(base),
  ...words(consultation).map((state) => "consultation_" + state),
];
const phases = words(
  source("telemetry.py").match(/^PHASES = frozenset\(\(([\s\S]*?)\)\)\n/m)![1],
);

describe("run event labels", () => {
  it("reads the events and phases of the service", () => {
    expect(events).toContain("consultation_announced");
    expect(events).toContain("consultation_held");
    expect(events.length).toBeGreaterThan(30);
    expect(phases).toContain("provider_answer");
  });
  for (const locale of ["en", "it"]) {
    it(`labels every event in ${locale}`, () => {
      const missing = events.filter(
        (event) =>
          !i18n.global.te("runEvents." + event, locale) &&
          !i18n.global.te("runDetail.events." + event, locale),
      );
      expect(missing).toEqual([]);
    });
    it(`labels every phase in ${locale}`, () => {
      expect(
        phases.filter(
          (phase) => !i18n.global.te("monitoring.phasesMap." + phase, locale),
        ),
      ).toEqual([]);
    });
  }
});
