import { describe, expect, it } from "vitest";
import { i18n } from "../src/i18n";
import { providerCodeText, runErrorText } from "../src/monitoring";

const composer = i18n.global as unknown as {
  t: (key: string, named?: Record<string, unknown>) => string;
  te: (key: string) => boolean;
  locale: { value: string } | string;
};
const use = (language: string) => {
  if (typeof composer.locale === "string") composer.locale = language;
  else composer.locale.value = language;
};
const text = (code: string) => runErrorText(code, composer.t, composer.te);

describe("run error text", () => {
  it("describes catalog codes and keeps the code for support", () => {
    use("en");
    expect(text("destination_denied")).toBe(
      "The destination is not permitted for this agent (destination_denied)",
    );
    use("it");
    expect(text("duration_exceeded")).toBe(
      "È stata raggiunta la durata massima della chiamata (duration_exceeded)",
    );
  });
  it("describes coded families", () => {
    use("en");
    expect(text("provider_http_503")).toBe(
      "The provider replied with HTTP error 503 (provider_http_503)",
    );
    expect(text("provider_hangup_127")).toBe(
      "The provider ended the call with cause 127 (provider_hangup_127)",
    );
    expect(text("setup_provider_accept_failed")).toBe(
      "Setup failed: Provider acceptance (setup_provider_accept_failed)",
    );
    expect(text("consultation_moh_timeout")).toBe(
      "Consultation timed out at step: music on hold (consultation_moh_timeout)",
    );
  });
  it("falls back to the raw code", () => {
    use("en");
    expect(text("unknown_future_code")).toBe("unknown_future_code");
    expect(providerCodeText("insufficient_quota", composer.t, composer.te)).toBe(
      "Provider quota exhausted (insufficient_quota)",
    );
    expect(providerCodeText("other", composer.t, composer.te)).toBe("other");
  });
  it("describes provider warnings in both languages", () => {
    use("en");
    expect(
      providerCodeText(
        "input_audio_rate_limit_exceeded",
        composer.t,
        composer.te,
      ),
    ).toBe(
      "The provider dropped some caller audio because it arrived too fast (input_audio_rate_limit_exceeded)",
    );
    use("it");
    expect(
      providerCodeText(
        "input_audio_rate_limit_exceeded",
        composer.t,
        composer.te,
      ),
    ).toMatch(/^Il provider ha scartato parte dell'audio del chiamante/);
  });
});
