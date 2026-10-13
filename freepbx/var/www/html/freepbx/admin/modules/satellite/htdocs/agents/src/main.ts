import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { library, config } from "@fortawesome/fontawesome-svg-core";
import {
  faComments,
  faWrench,
  faDatabase,
  faClock,
  faGear,
  faMoon,
  faSun,
  faDiagramProject,
  faArrowUpRightFromSquare,
  faBars,
} from "@fortawesome/free-solid-svg-icons";
import App from "./App.vue";
import { router } from "./router";
import { i18n } from "./i18n";
import { queryClient } from "./api";
import "./assets/main.css";

config.autoAddCss = false;
library.add(
  faComments,
  faWrench,
  faDatabase,
  faClock,
  faGear,
  faMoon,
  faSun,
  faDiagramProject,
  faArrowUpRightFromSquare,
  faBars,
);
createApp(App)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(VueQueryPlugin, { queryClient })
  .component("FontAwesomeIcon", FontAwesomeIcon)
  .mount("#app");
