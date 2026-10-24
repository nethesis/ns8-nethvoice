import { createRouter, createWebHashHistory } from "vue-router";
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/agents" },
    { path: "/agents", component: () => import("./views/AgentsView.vue") },
    { path: "/agents/new", component: () => import("./views/AgentView.vue") },
    { path: "/agents/:id", component: () => import("./views/AgentView.vue") },
    { path: "/trunks", component: () => import("./views/TrunksView.vue") },
    { path: "/activity", component: () => import("./views/ActivityView.vue") },
    { path: "/activity/:id", component: () => import("./views/RunView.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/agents" },
  ],
});
