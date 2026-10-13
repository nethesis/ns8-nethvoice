import { createRouter, createWebHashHistory } from "vue-router";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/agents" },
    { path: "/agents", component: () => import("./views/AgentsView.vue") },
    {
      path: "/agents/new",
      component: () => import("./views/NewAgentView.vue"),
    },
    {
      path: "/agents/:id/:tab(general|workflow|tools|test)?",
      component: () => import("./views/AgentView.vue"),
    },
    {
      path: "/workflows/new",
      component: () => import("./views/NewAgentView.vue"),
      meta: { kind: "subflow" },
    },
    {
      path: "/workflows/:id/:tab(general|workflow|tools|test)?",
      component: () => import("./views/AgentView.vue"),
      meta: { kind: "subflow" },
    },
    { path: "/tools", component: () => import("./views/ToolsView.vue") },
    { path: "/tools/:id", component: () => import("./views/ToolView.vue") },
    { path: "/sources", component: () => import("./views/SourcesView.vue") },
    { path: "/sources/:id", component: () => import("./views/SourceView.vue") },
    { path: "/activity", component: () => import("./views/ActivityView.vue") },
    { path: "/activity/:id", component: () => import("./views/RunView.vue") },
    {
      path: "/settings/:tab?",
      component: () => import("./views/SettingsView.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: "/agents" },
  ],
});
