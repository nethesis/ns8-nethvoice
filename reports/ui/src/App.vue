<template>
  <div id="app">
    <!-- handle popups -->
    <portal-target name="semantic-ui-vue"></portal-target>
    <!-- login view -->
    <div v-show="!isLogged">
      <Login />
    </div>
    <!-- end login view -->
    <!-- logged view -->
    <div v-if="isLogged">
      <!-- start leftsidebar -->
      <LeftSidebar />
      <!-- mobile topbar -->
      <MobileTopBar />
      <div views-wrapper="true" class="docs-container" @click="hideSidebar()">
        <!-- start topbar -->
        <TopBar />
        <!-- end topbar -->
        <div class="mg-3-em">
          <router-view />
        </div>
        <BackToTop scrollTop="400" />
      </div>
    </div>
    <!-- end logged view -->
  </div>
</template>

<script>
import Login from "./views/Login.vue";
import LeftSidebar from "./components/LeftSidebar.vue";
import TopBar from "./components/TopBar.vue";
import BackToTop from "./components/BackToTop.vue";
import MobileTopBar from "./components/MobileTopBar.vue";
import LoginService from "./services/login";
import StorageService from "./services/storage";

export default {
  name: "App",
  components: {
    Login: Login,
    LeftSidebar: LeftSidebar,
    TopBar: TopBar,
    BackToTop: BackToTop,
    MobileTopBar: MobileTopBar,
  },
  mixins: [LoginService, StorageService],
  mounted() {
    document.title = this.reportPageTitle();
    this.applyFavicon();
    // hide body
    document.body.classList.add("hide");

    // check token validity and refresh
    this.execRefresh(
      () => {
        this.isLogged = true;
        document.body.classList.add("show");
      },
      () => {
        // error
        this.isLogged = false;
        document.body.classList.add("show");
      }
    );

    // handle viewport width
    this.$nextTick(() => {
      window.addEventListener("resize", this.resizeHandler, true);
    });
  },
  data() {
    return {
      isLogged: false,
    };
  },
  methods: {
    reportPageTitle() {
      const configuredBrand = (this.$root.config.BRAND_NAME || "").trim();

      if (
        !configuredBrand ||
        configuredBrand === "NethVoice" ||
        configuredBrand === "NethVoice Reports"
      ) {
        return "Report";
      }

      return `${configuredBrand} | Report`;
    },
    applyFavicon() {
      const faviconUrl = this.$root.config.FAVICON_URL || "favicon.ico";
      let faviconLink = document.querySelector("link[rel='icon']");

      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.setAttribute("rel", "icon");
        document.head.appendChild(faviconLink);
      }

      faviconLink.setAttribute("href", faviconUrl);
    },
    didLogin() {
      this.isLogged = true;
    },
    didLogout() {
      this.isLogged = false;

      // remove from localstorage
      this.delete("loggedUser");

      // remove all event listeners
      this.$root.$off();

      // reset state of $root
      this.$root.filtersReady = false;
      this.$root.phonebook = [];
      this.$root.reversePhonebook = {};
      this.$root.colorScheme = "";
    },
    hideSidebar() {
      if (window.innerWidth < this.$mobileBound) {
        document.querySelector("#docs-menu").style.transform =
          "translateX(-270px)";
        this.$root.$emit("sidebarHide");
      }
    },
    resizeHandler() {
      let sidebar = document.querySelector("#docs-menu");
      if (
        window.innerWidth > this.$mobileBound &&
        sidebar.style.transform == "translateX(-270px)"
      ) {
        sidebar.style.transform = "translateX(0px)";
      }
    },
  },
};
</script>

<style lang="scss">
@import "./styles/theming.scss";

body {
  min-width: 421px !important;

  @media only screen and (max-width: $mobile-bound) {
    & {
      height: calc(100% - 40px) !important;
    }
  }
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

.hide {
  display: none;
}

.show {
  display: block;
}

.docs-container {
  margin-left: 260px;
  width: calc(100% - 260px);
  height: 100vh;
  overflow-y: scroll;
  overflow-x: hidden;

  @media only screen and (max-width: $mobile-bound) {
    & {
      margin-top: 40px;
      height: calc(100vh - 40px);
      margin-left: 0px;
      width: calc(100%);
    }
  }
}

#nav {
  padding: 30px;

  a {
    font-weight: bold;
    color: #2c3e50;

    &.router-link-exact-active {
      color: #42b983;
    }
  }
}

.mg-right-xs {
  margin-right: 0.5rem !important;
}

.mg-right-sm {
  margin-right: 1rem !important;
}

.mg-right-xl {
  margin-right: 4rem !important;
}

.ui.multiple.search.dropdown > input.search {
  width: 100% !important;
}

.no-mg {
  margin: 0 !important;
}

.no-mg-top {
  margin-top: 0 !important;
}

.no-mg-left {
  margin-left: 0 !important;
}

.mg-left-sm {
  margin-left: 1rem !important;
}

.mg-top-xs {
  margin-top: 0.5rem !important;
}

.mg-top-md {
  margin-top: 2rem !important;
  padding-left: 7px;
}

.mg-bottom-sm {
  margin-bottom: 1rem !important;
}

.mg-bottom-md {
  margin-bottom: 2rem !important;
}

.mg-3-em {
  margin: 0 3em 3em;
}

.table-chart {
  width: 95%;
  margin: 2rem;
}

.recap-chart {
  width: 100%;
  margin: 2rem;
}

.rank-chart {
  min-width: 25rem;
  max-width: 35rem;
  margin: 2rem;
}

.line-chart {
  width: 95%;
  margin: 2rem;
}

.bar-chart {
  width: 95%;
  margin: 2rem;
}

.pie-chart {
  width: 26rem;
  margin: 2rem 2rem 3rem 2rem;
}

.loader-height {
  height: 6rem !important;
}

.chart-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.show-details {
  margin-top: 1rem;
}

.settings-description {
  color: gray;
  margin-top: 1em;
  margin-bottom: 1.5rem;
}

.component-body {
  position: relative;
  margin-left: 3em !important;
  margin-right: 3em !important;
  padding: 2em 0em 7em;
  width: auto;
}

.modals {
  z-index: 1001 !important;
}

.icon.cursor-default {
  cursor: default !important;
}

.masthead.topbar {
  padding: 14px 0px 15px 0px !important;
  min-height: 65px;
  margin-bottom: 0 !important;
  border-bottom: none;
  box-shadow: none;

  .ui.container {
    margin-right: 3em !important;
    margin-left: 3em !important;
    width: auto !important;

    .ui.header {
      margin: 0px !important;
    }

    .ui.right.floated.menu {
      margin-top: -2px;
    }
  }

  @media only screen and (max-width: $mobile-bound) {
    & {
      border-bottom: 1px solid rgba(34, 36, 38, 0.15);
      box-shadow: -2px 1px 2px 0 rgba(34, 36, 38, 0.15) !important;
    }
  }
}

.ui.pagination.menu.no-border {
  box-shadow: none;
  border: 0;
  background: initial;
}

.ui.input.current-page > input {
  width: 4rem !important;
  text-align: center;
}

.ui.selection.dropdown {
  min-width: min-content !important;
}

.ui.selection.dropdown.rows-per-page {
  width: 5.5rem;
  min-width: 0;
}

.ui.pagination.menu .item.select-rows-per-page {
  padding-left: 0.4rem;
  padding-right: 0.4rem;
  min-width: 0;
}

.ui.menu .dropdown.item.select-rows-per-page .menu {
  min-width: 10.5rem;
}

.menu-item-padding.ui.dropdown {
  padding-left: 0;
}

.ui.menu .item.small-pad {
  padding-left: 0.8rem;
  padding-right: 0.8rem;
}

.ui.menu .item.select-rows-per-page > i.dropdown.icon {
  margin: 0;
}

.ui.menu .ui.dropdown .menu > .item .icon:not(.dropdown).check {
  float: right !important;
  margin-right: 0 !important;
}

.no-border.ui.menu .item:before {
  background: none;
}

.report-data-not-available {
  width: 100%;
}

.error-color {
  color: #9f3a38 !important;
}

.field-error input {
  background-color: #fff6f6 !important;
  color: #9f3a38 !important;
  border-color: #e0b4b4 !important;
}

.no-margin {
  margin: 0 !important;
}

.full-width {
  width: 100% !important;
}

.filters-form .mx-datepicker input {
  height: 38px !important;
  margin-top: -2px !important;
}

.mx-datepicker-main {
  margin-top: 5px;
  border-radius: 0.28571429rem !important;
  color: rgba(0, 0, 0, 0.87) !important;
  font-weight: 600;
}

.ui.dimmer .ui.fix.loader:before {
  border-color: rgba(0, 0, 0, 0.1);
}

.ui.dimmer .ui.fix.loader:after {
  border-color: #767676 transparent transparent;
}

.color-transparent {
  color: transparent !important;
}

.input-error input {
  background: #fff6f6 !important;
  border-color: #e0b4b4 !important;
  color: #9f3a38 !important;
}

.blink-icon {
  font-size: 1.1rem !important;
}

.blink-opacity {
  animation: blinkOpacity 2s infinite;
}

@keyframes blinkOpacity {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
  100% {
    opacity: 1;
  }
}

.created-icon {
  margin: 0.5rem 0 0 0 !important;
}

/* CSS for v-tooltip */
.tooltip {
  display: block !important;
  z-index: 10000;
  box-shadow: 0px 2px 4px 0px rgba(34, 36, 38, 0.12),
    0px 2px 10px 0px rgba(34, 36, 38, 0.15);
  border: 1px solid #d4d4d5;
}
.tooltip .tooltip-inner {
  background: #ffffff;
  color: rgba(0, 0, 0, 0.87);
  border-radius: 0.28571429rem;
  padding: 0.833em 1em;
}
.tooltip .tooltip-arrow {
  width: 0;
  height: 0;
  border-style: solid;
  position: absolute;
  margin: 5px;
  border-color: #ffffff;
  z-index: 1;
}
.tooltip[x-placement^="top"] {
  margin-bottom: 5px;
}
.tooltip[x-placement^="top"] .tooltip-arrow {
  border-width: 5px 5px 0 5px;
  border-left-color: transparent !important;
  border-right-color: transparent !important;
  border-bottom-color: transparent !important;
  bottom: -5px;
  left: calc(50% - 5px);
  margin-top: 0;
  margin-bottom: 0;
}
.tooltip[x-placement^="bottom"] {
  margin-top: 5px;
}
.tooltip[x-placement^="bottom"] .tooltip-arrow {
  border-width: 0 5px 5px 5px;
  border-left-color: transparent !important;
  border-right-color: transparent !important;
  border-top-color: transparent !important;
  top: -5px;
  left: calc(50% - 5px);
  margin-top: 0;
  margin-bottom: 0;
}
.tooltip[x-placement^="right"] {
  margin-left: 5px;
}
.tooltip[x-placement^="right"] .tooltip-arrow {
  border-width: 5px 5px 5px 0;
  border-left-color: transparent !important;
  border-top-color: transparent !important;
  border-bottom-color: transparent !important;
  left: -5px;
  top: calc(50% - 5px);
  margin-left: 0;
  margin-right: 0;
}
.tooltip[x-placement^="left"] {
  margin-right: 5px;
}
.tooltip[x-placement^="left"] .tooltip-arrow {
  border-width: 5px 0 5px 5px;
  border-top-color: transparent !important;
  border-right-color: transparent !important;
  border-bottom-color: transparent !important;
  right: -5px;
  top: calc(50% - 5px);
  margin-left: 0;
  margin-right: 0;
}
.tooltip.popover .popover-inner {
  background: #f9f9f9;
  color: black;
  padding: 24px;
  border-radius: 5px;
  box-shadow: 0 5px 30px rgba(black, 0.1);
}
.tooltip.popover .popover-arrow {
  border-color: #f9f9f9;
}
.tooltip[aria-hidden="true"] {
  visibility: hidden;
  opacity: 0;
}
.tooltip[aria-hidden="false"] {
  visibility: visible;
  opacity: 1;
}
/* end CSS for v-tooltip */

.ui.inline.loader.loading-filters {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.doc-info-icon {
  color: #2185d0;
  margin-left: 0.3rem !important;
  margin-right: 0 !important;
}

.doc-info {
  text-align: left !important;
  max-width: 35rem !important;
  max-height: 14rem;
  overflow-y: auto;
}

.markdown h1 {
  font-size: 1.28571429rem;
}

.markdown h2 {
  font-size: 1.07142857rem;
}

.markdown h3 {
  font-size: 1rem;
}

.markdown h4 {
  font-size: 0.67em;
}

.align-center {
    text-align: center !important;
}

.align-left {
    text-align: left !important;
}
</style>
