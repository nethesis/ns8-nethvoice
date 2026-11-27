// The NethVoice wizard keeps the language chosen in its account menu
// under this key, as a JSON string, on the same origin.
export const WIZARD_LANGUAGE_KEY = "preferredLanguage";

export type Language = "en" | "it";

function supported(value: string): Language {
  return value.toLowerCase().startsWith("it") ? "it" : "en";
}

// The language of the wizard, or of the browser when the wizard has
// none, so that both interfaces always speak the same language.
export function wizardLanguage(stored?: string | null): Language {
  let raw = stored;
  if (raw === undefined) {
    try {
      raw = localStorage.getItem(WIZARD_LANGUAGE_KEY);
    } catch {
      raw = null;
    }
  }
  if (raw) {
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value === "string" && value) return supported(value);
    } catch {
      return supported(raw);
    }
  }
  return supported(navigator.language || "en");
}
