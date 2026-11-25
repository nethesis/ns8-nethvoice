import { useI18n } from "vue-i18n";
import { loadErrorCode } from "../api";

export function useLoadError() {
  const { t, te } = useI18n();
  return (...errors: unknown[]) => {
    const code = loadErrorCode(errors.find(Boolean));
    return te("error." + code) ? t("error." + code) : t("error.request_failed");
  };
}
