import { defineStore } from "pinia";
import { ref } from "vue";

export const useUi = defineStore("ui", () => {
  const stored = localStorage.getItem("nethvoice.agents.theme");
  const dark = ref(
    stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const notices = ref<
    {
      id: string;
      kind: "success" | "error";
      title: string;
      description?: string;
      timestamp: Date;
      isShown: boolean;
    }[]
  >([]);
  function applyTheme() {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", dark.value);
    window.getComputedStyle(root).getPropertyValue("color");
    window.requestAnimationFrame(() =>
      root.classList.remove("theme-switching"),
    );
  }
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (event) => {
      if (localStorage.getItem("nethvoice.agents.theme")) return;
      dark.value = event.matches;
      applyTheme();
    });
  function toggleTheme() {
    dark.value = !dark.value;
    localStorage.setItem(
      "nethvoice.agents.theme",
      dark.value ? "dark" : "light",
    );
    applyTheme();
  }
  function notify(
    title: string,
    description?: string,
    kind: "success" | "error" = "success",
  ) {
    const id = crypto.randomUUID();
    notices.value.push({
      id,
      kind,
      title,
      description,
      timestamp: new Date(),
      isShown: true,
    });
    window.setTimeout(() => {
      notices.value = notices.value.filter((n) => n.id !== id);
    }, 7000);
  }
  // Path the next navigation reaches without remounting the current view.
  const keepView = ref("");
  // An editor with unsaved changes keeps the view mounted while the session
  // is expired, so that the changes stay on the page until sign-in.
  const sessionHold = ref(0);
  applyTheme();
  return {
    dark,
    notices,
    toggleTheme,
    notify,
    keepView,
    sessionHold,
  };
});
