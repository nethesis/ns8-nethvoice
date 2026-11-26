import { createRouter, createWebHashHistory } from "vue-router";
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/agents" },
    // The list, with the Create agent drawer open at /agents/new.
    {
      path: "/agents/:create(new)?",
      component: () => import("./views/AgentsView.vue"),
    },
    { path: "/agents/:id", component: () => import("./views/AgentView.vue") },
    { path: "/trunks", component: () => import("./views/TrunksView.vue") },
    { path: "/activity", component: () => import("./views/ActivityView.vue") },
    { path: "/activity/:id", component: () => import("./views/RunView.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/agents" },
  ],
});

// An address typed in the browser creates a history entry without router
// state. vue-router gives that entry the position of the previous one, so a
// Back cancelled by the Unsaved changes dialog would then move one more entry
// back, leaving the address on another page. Give it the next position.
window.addEventListener("popstate", (event) => {
  if (event.state !== null) return;
  const state = router.options.history.state as { position?: number };
  if (typeof state?.position !== "number") return;
  state.position += 1;
  history.replaceState({ ...history.state, position: state.position }, "");
});
