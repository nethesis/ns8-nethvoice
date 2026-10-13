import { createRouter, createWebHashHistory } from "vue-router";
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/agents" },
    { path: "/agents", component: () => import("./views/AgentsView.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/agents" },
  ],
});
