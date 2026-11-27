import { createI18n } from "vue-i18n";
import { wizardLanguage } from "./language";
import en from "./i18n/en/translation.json";
import it from "./i18n/it/translation.json";

export const i18n = createI18n({
  legacy: false,
  locale: wizardLanguage(),
  fallbackLocale: "en",
  messages: { en, it },
});
