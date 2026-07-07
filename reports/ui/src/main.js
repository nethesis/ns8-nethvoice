import Vue from "vue";
import VueResource from "vue-resource";
import VueI18n from "vue-i18n";
import PortalVue from "portal-vue";
import VueLodash from 'vue-lodash';
import lodash from 'lodash';
import VueScrollTo from 'vue-scrollto';
import VueShowdown from "vue-showdown";
import VTooltip from "v-tooltip";
import CountryFlag from 'vue-country-flag'

import DatePicker from 'vue2-datepicker';
import 'vue2-datepicker/index.css';
import 'vue2-datepicker/locale/en';
import 'vue2-datepicker/locale/it';

import App from "./App.vue";
import router from "./router";
import languages from "./i18n/lang";

import SuiVue from "semantic-ui-vue";
import "semantic-ui-css/semantic.min.css";
import "./styles/main.css";

import "./filters/filters";

import "chartjs-plugin-colorschemes"

Vue.config.productionTip = false;
Vue.use(SuiVue);

Vue.use(VueResource);
Vue.http.interceptors.push(function () {
  return function (response) {
    if (response.status == 401 && response.body && response.body.message == "Token is expired") {
      // authentication token has expired, show login page
      this.$root.$emit("logout");
    } else if (response.status == 400 && response.body && /Table 'asteriskcdrdb.+doesn't exist/.test(response.body.status)) {
      // non-existent table, come back tomorrow
      this.$root.$emit("cdrDataNotAvailable");
    }
  };
});

Vue.use(VueI18n);
Vue.use(PortalVue);
Vue.use(VueLodash, { name: 'ldsh', lodash: lodash });
Vue.use(VueScrollTo)
Vue.use(DatePicker)
Vue.use(VueShowdown)
Vue.use(VTooltip);
Vue.component('country-flag', CountryFlag)

// configure i18n
var langConf = languages.initLang();
const i18n = new VueI18n({
  locale: langConf.locale,
  messages: langConf.messages,
});

// momentjs
window.moment = require("moment");
window.moment.locale(i18n.vm.locale);

// global variable
Vue.prototype.$mobileBound = 1193 // px

new Vue({
  router,
  i18n,
  created: function () {
    this.apiEndpoint = window.CONFIG.API_ENDPOINT;
    this.apiScheme = window.CONFIG.API_SCHEME;
    this.currentLocale = langConf.locale;
    this.config = window.CONFIG;
  },
  data: {
    filtersReady: false,
    phonebook: [],
    reversePhonebook: {},
    devices: {},
    colorScheme: "",
    queues: {},
    users: [],
  },
  render: (h) => h(App),
}).$mount("#app");
