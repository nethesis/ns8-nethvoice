import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { library, config } from "@fortawesome/fontawesome-svg-core";
import {
  faCircleExclamation,
  faEye,
  faEyeSlash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import App from "./App.vue";
import { router } from "./router";
import { i18n } from "./i18n";
import { queryClient } from "./api";
import "./assets/main.css";

config.autoAddCss = false;
// The app imports each icon where it uses it. These are the icons that
// @nethesis/vue-components names by string.
library.add(faCircleExclamation, faEye, faEyeSlash, faXmark);
createApp(App)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(VueQueryPlugin, { queryClient })
  .component("FontAwesomeIcon", FontAwesomeIcon)
  .mount("#app");
