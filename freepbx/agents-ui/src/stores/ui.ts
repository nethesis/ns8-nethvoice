import { defineStore } from "pinia";
import { ref } from "vue";

export const useUi = defineStore("ui", () => {
  const dark = ref(localStorage.getItem("nethvoice.agents.theme") !== "light");
  const notices = ref<
    { id: string; kind: "success" | "error"; title: string; isShown: boolean }[]
  >([]);
  function applyTheme() {
    document.documentElement.classList.toggle("dark", dark.value);
  }
  function toggleTheme() {
    dark.value = !dark.value;
    localStorage.setItem(
      "nethvoice.agents.theme",
      dark.value ? "dark" : "light",
    );
    applyTheme();
  }
  function notify(title: string, kind: "success" | "error" = "success") {
    const id = crypto.randomUUID();
    notices.value.push({ id, kind, title, isShown: true });
    window.setTimeout(() => {
      notices.value = notices.value.filter((n) => n.id !== id);
    }, 7000);
  }
  const leaveDialog = ref(false);
  let leaveResolve: ((value: boolean) => void) | undefined;
  function confirmLeave() {
    leaveDialog.value = true;
    return new Promise<boolean>((resolve) => {
      leaveResolve = resolve;
    });
  }
  function resolveLeave(value: boolean) {
    leaveDialog.value = false;
    leaveResolve?.(value);
    leaveResolve = undefined;
  }
  applyTheme();
  return {
    dark,
    notices,
    toggleTheme,
    notify,
    leaveDialog,
    confirmLeave,
    resolveLeave,
  };
});
