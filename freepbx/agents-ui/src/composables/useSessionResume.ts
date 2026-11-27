import { onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { auth, signIn } from "../api";
import { useUi } from "../stores/ui";

/**
 * Session expiry in an editor: while there are unsaved changes the editor
 * stays on the page and shows the Session expired dialog. After signing in
 * again, the interrupted save runs again.
 */
export function useSessionResume(hasChanges: () => boolean) {
  const ui = useUi();
  const { t } = useI18n();
  const dialog = ref(false);
  let holding = false;
  let retry: (() => unknown) | undefined;
  function hold() {
    if (holding) return;
    holding = true;
    ui.sessionHold++;
  }
  function release() {
    if (!holding) return;
    holding = false;
    ui.sessionHold--;
  }
  function expired(event: Event) {
    const detail = (event as CustomEvent<{ busy?: boolean }>).detail;
    if (!hasChanges() && !detail?.busy) return;
    hold();
    dialog.value = true;
  }
  /** A save failed because the session expired: retry it after sign-in. */
  function interrupted(action: () => unknown) {
    retry = action;
    hold();
    dialog.value = true;
  }
  function signInAgain() {
    dialog.value = false;
    signIn(true);
  }
  function cancel() {
    dialog.value = false;
  }
  watch(
    () => auth.authorized,
    (value) => {
      if (!value || !holding) return;
      release();
      dialog.value = false;
      ui.notify(t("sessionDialog.signedIn"), t("sessionDialog.signedInHelp"));
      const action = retry;
      retry = undefined;
      if (action) void action();
    },
  );
  onMounted(() => window.addEventListener("agents-auth-expired", expired));
  onUnmounted(() => {
    window.removeEventListener("agents-auth-expired", expired);
    release();
  });
  return { dialog, interrupted, signInAgain, cancel, holding: () => holding };
}
