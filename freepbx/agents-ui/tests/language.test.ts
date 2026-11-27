import { describe, expect, it, vi } from "vitest";
import { wizardLanguage } from "../src/language";

describe("language of the wizard", () => {
  it("follows the language chosen in the wizard", () => {
    expect(wizardLanguage(JSON.stringify("it"))).toBe("it");
    expect(wizardLanguage(JSON.stringify("en"))).toBe("en");
  });
  it("shows English for a wizard language without translations", () => {
    expect(wizardLanguage(JSON.stringify("de"))).toBe("en");
  });
  it("falls back to the browser without a wizard language", () => {
    vi.stubGlobal("navigator", { language: "it-IT" });
    expect(wizardLanguage(null)).toBe("it");
    expect(wizardLanguage("")).toBe("it");
    vi.stubGlobal("navigator", { language: "fr-FR" });
    expect(wizardLanguage(null)).toBe("en");
    vi.unstubAllGlobals();
  });
  it("accepts a value stored without JSON quotes", () => {
    expect(wizardLanguage("it")).toBe("it");
  });
});
