import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { errorCode } from "../api";
import { useUi } from "../stores/ui";

export function useTask() {
  const pending = ref(false),
    error = ref("");
  const { t, te } = useI18n();
  const ui = useUi();
  async function run<T>(
    operation: () => Promise<T>,
    notify = true,
  ): Promise<T | undefined> {
    if (pending.value) return undefined;
    pending.value = true;
    error.value = "";
    try {
      const value = await operation();
      if (notify) ui.notify(t("success"));
      return value;
    } catch (failure) {
      const code = errorCode(failure);
      error.value = te("error." + code)
        ? t("error." + code)
        : t("error.request_failed");
      return undefined;
    } finally {
      pending.value = false;
    }
  }
  return { pending, error, run };
}
