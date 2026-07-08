<template>
  <sui-menu
    is="sui-sidebar"
    id="docs-menu"
    inverted="true"
    vertical="true"
    animation="overlay"
    @click="handlePropagation($event)"
    v-bind:visible="true"
  >
    <sui-menu-item class="white-color">
      <i class="user icon align-left mr-10 no-margin-left cursor-default"></i>
      <strong>
        {{ loggedUsername }}
      </strong>
    </sui-menu-item>
    <sui-menu-item class="report-switch-row">
      <!-- <sui-image :src="`/static/images/logo.png`" spaced="right" size="mini" /> -->
      <div class="report-switch-container">
        <sui-dropdown :text="$t('menu.' + selectedReport)">
          <sui-dropdown-menu>
            <sui-dropdown-item v-if="authMap.Queues" @click="selectReport('queue')" class="report-select">
              <router-link to="/queue" class="menu-item-color report-link">
                {{ $t("menu.queue") }}
              </router-link>
            </sui-dropdown-item>
            <sui-dropdown-item v-if="authMap.CdrPersonal || authMap.CdrPbx" @click="selectReport('cdr')" class="report-select">
              <router-link to="/cdr" class="menu-item-color report-link">
                {{ $t("menu.cdr") }}
              </router-link>
            </sui-dropdown-item>
          </sui-dropdown-menu>
        </sui-dropdown>
        <span>
          <sui-popup :content="$t('message.access_cdr_report')" flowing>
            <sui-icon
              v-show="$route.meta.report != 'cdr' && !cdrVisited"
              name="exclamation circle"
              color="blue"
              class="blink-opacity blink-icon mg-left-sm"
              slot="trigger"
            />
          </sui-popup>
        </span>
      </div>
    </sui-menu-item>
    <sui-menu-item>
      <i
        @click="clearText()"
        :class="[search.length > 0 ? 'remove' : 'search', 'icon']"
      ></i>
      <sui-input
        inverted
        :placeholder="$t('menu.start_typing') + '...'"
        transparent
        v-model="search"
        class="block"
      />
    </sui-menu-item>
    <!-- is queue -->
    <div v-if="selectedReport == 'queue' && authMap.Queues">
      <router-link
        class="item fw-6 menu-section"
        :class="isActive('/queue') ? 'active' : ''"
        to="/queue"
      >
        {{ $t("menu.dashboard") }}
        <span
          v-show="isTag('/queue')"
          class="press-enter dot no-margin-top"
        ></span>
      </router-link>

      <sui-menu-item class="menu-section" :active="isActive('data', true)">
        <sui-menu-header>{{ $t("menu.data") }}</sui-menu-header>
        <sui-menu-menu>
          <span
            v-show="isTag('/queue/data/summary')"
            class="press-enter dot-small"
          ></span>
          <router-link
            size="big"
            is="sui-menu-item"
            :active="isActive('/queue/data/summary')"
            to="/queue/data/summary"
            >{{ $t("data.summary") }}</router-link
          >
          <span
            v-show="isTag('/queue/data/agent')"
            class="press-enter dot-small"
          ></span>
          <router-link
            size="big"
            is="sui-menu-item"
            :active="isActive('/queue/data/agent')"
            to="/queue/data/agent"
            >{{ $t("data.by_agent") }}</router-link
          >
          <span
            v-show="isTag('/queue/data/session')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/data/session')"
            to="/queue/data/session"
            >{{ $t("data.by_session") }}</router-link
          >
          <span
            v-show="isTag('/queue/data/caller')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/data/caller')"
            to="/queue/data/caller"
            >{{ $t("data.by_caller") }}</router-link
          >
          <span
            v-show="isTag('/queue/data/call')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/data/call')"
            to="/queue/data/call"
            >{{ $t("data.by_call") }}</router-link
          >
          <span
            v-show="isTag('/queue/data/lost_call')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/data/lost_call')"
            to="/queue/data/lost_call"
            >{{ $t("data.by_lost_call") }}</router-link
          >
          <span
            v-show="isTag('/queue/data/ivr')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/data/ivr')"
            to="/queue/data/ivr"
            >{{ $t("data.ivr") }}</router-link
          >
        </sui-menu-menu>
      </sui-menu-item>

      <router-link
        class="item fw-6 menu-section"
        :class="isActive('/queue/performance') ? 'active' : ''"
        to="/queue/performance"
      >
        {{ $t("menu.performance") }}
        <span
          v-show="isTag('/queue/performance')"
          class="press-enter dot no-margin-top"
        ></span>
      </router-link>

      <sui-menu-item
        class="menu-section"
        :active="isActive('distribution', true)"
      >
        <sui-menu-header>{{ $t("menu.distribution") }}</sui-menu-header>
        <sui-menu-menu>
          <span
            v-show="isTag('/queue/distribution/hour')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/distribution/hour')"
            to="/queue/distribution/hour"
            >{{ $t("distribution.by_hour") }}</router-link
          >
          <span
            v-show="isTag('/queue/distribution/geo')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/distribution/geo')"
            to="/queue/distribution/geo"
            >{{ $t("distribution.by_geo") }}</router-link
          >
        </sui-menu-menu>
      </sui-menu-item>

      <sui-menu-item class="menu-section" :active="isActive('graphs', true)">
        <sui-menu-header>{{ $t("menu.graphs") }}</sui-menu-header>
        <sui-menu-menu>
          <span
            v-show="isTag('/queue/graphs/load')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/graphs/load')"
            to="/queue/graphs/load"
            >{{ $t("graphs.load") }}</router-link
          >
          <span
            v-show="isTag('/queue/graphs/hour')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/graphs/hour')"
            to="/queue/graphs/hour"
            >{{ $t("graphs.by_hour") }}</router-link
          >
          <span
            v-show="isTag('/queue/graphs/agent')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/graphs/agent')"
            to="/queue/graphs/agent"
            >{{ $t("graphs.by_agent") }}</router-link
          >
          <span
            v-show="isTag('/queue/graphs/area')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/graphs/area')"
            to="/queue/graphs/area"
            >{{ $t("graphs.by_area") }}</router-link
          >
          <span
            v-show="isTag('/queue/graphs/queue_position')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/graphs/queue_position')"
            to="/queue/graphs/queue_position"
            >{{ $t("graphs.queue_position") }}</router-link
          >
          <span
            v-show="isTag('/queue/graphs/avg_duration')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/graphs/avg_duration')"
            to="/queue/graphs/avg_duration"
            >{{ $t("graphs.average_duration") }}</router-link
          >
          <span
            v-show="isTag('/queue/graphs/avg_wait')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/graphs/avg_wait')"
            to="/queue/graphs/avg_wait"
            >{{ $t("graphs.average_wait") }}</router-link
          >
          <router-link
            is="sui-menu-item"
            :active="isActive('/queue/graphs/recall')"
            to="/queue/graphs/recall"
            >{{ $t("graphs.recall") }}</router-link
          >
        </sui-menu-menu>
      </sui-menu-item>
    </div>
    <!-- is cdr -->
    <div v-if="selectedReport == 'cdr'">
      <router-link
        class="item fw-6 menu-section"
        :class="isActive('/cdr') ? 'active' : ''"
        to="/cdr"
      >
        {{ $t("menu.dashboard") }}
        <span
          v-show="isTag('/cdr')"
          class="press-enter dot no-margin-top"
        ></span>
      </router-link>
      <sui-menu-item
        v-if="authMap.CdrPbx"
        class="menu-section"
        :active="isActive('data', true)"
      >
        <sui-menu-header>{{ $t("menu.pbx") }}</sui-menu-header>
        <sui-menu-menu>
          <span
            v-show="isTag('/cdr/pbx/inbound')"
            class="press-enter dot-small"
          ></span>
          <router-link
            size="big"
            is="sui-menu-item"
            :active="isActive('/cdr/pbx/inbound')"
            to="/cdr/pbx/inbound"
            >{{ $t("menu.inbound") }}</router-link
          >
          <span
            v-show="isTag('/cdr/pbx/outbound')"
            class="press-enter dot-small"
          ></span>
          <router-link
            size="big"
            is="sui-menu-item"
            :active="isActive('/cdr/pbx/outbound')"
            to="/cdr/pbx/outbound"
            >{{ $t("menu.outbound") }}</router-link
          >
          <span
            v-show="isTag('/cdr/pbx/local')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/cdr/pbx/local')"
            to="/cdr/pbx/local"
            >{{ $t("menu.local") }}</router-link
          >
        </sui-menu-menu>
      </sui-menu-item>
      <sui-menu-item
        v-if="authMap.CdrPersonal && loggedUsername != 'admin'"
        class="menu-section"
        :active="isActive('data', true)"
      >
        <sui-menu-header>{{ $t("menu.personal") }}</sui-menu-header>
        <sui-menu-menu>
          <span
            v-show="isTag('/cdr/personal/inbound')"
            class="press-enter dot-small"
          ></span>
          <router-link
            size="big"
            is="sui-menu-item"
            :active="isActive('/cdr/personal/inbound')"
            to="/cdr/personal/inbound"
            >{{ $t("menu.inbound") }}</router-link
          >
          <span
            v-show="isTag('/cdr/personal/outbound')"
            class="press-enter dot-small"
          ></span>
          <router-link
            size="big"
            is="sui-menu-item"
            :active="isActive('/cdr/personal/outbound')"
            to="/cdr/personal/outbound"
            >{{ $t("menu.outbound") }}</router-link
          >
          <span
            v-show="isTag('/cdr/personal/local')"
            class="press-enter dot-small"
          ></span>
          <router-link
            is="sui-menu-item"
            :active="isActive('/cdr/personal/local')"
            to="/cdr/personal/local"
            >{{ $t("menu.local") }}</router-link
          >
        </sui-menu-menu>
      </sui-menu-item>
    </div>
  </sui-menu>
</template>

<script>
import StorageService from "../services/storage";
import AuthService from "../services/authorizations";

export default {
  name: "LeftSidebar",
  mixins: [
    StorageService,
    AuthService
  ],
  data() {
    return {
      search: "",
      taggedRoutes: [],
      selectedReport: this.$route.meta.report,
      loggedUsername: this.get("loggedUser")
        ? this.get("loggedUser").username
        : "",
      cdrVisited: false,
      authMap: {
        CdrPbx: false,
        CdrPersonal: false,
        Queues: false
      }
    };
  },
  watch: {
    search: function (val) {
      var context = this;
      if (val.length >= 3) {
        this.taggedRoutes = this.$router.options.routes
          .filter(function (r) {
            if (r.meta && r.meta.tags) {
              var i18nTags = r.meta.tags.map(function (t) {
                return context.$i18n.t("tags." + t);
              });
              return JSON.stringify(i18nTags)
                .toLowerCase()
                .includes(val.toLowerCase());
            } else {
              return false;
            }
          })
          .map(function (r) {
            return r.path;
          });
      } else {
        this.taggedRoutes = [];
      }
    },
    $route: function () {
      this.checkCdrVisited();
    },
  },
  mounted() {
    this.cdrVisited = this.get("cdrVisited");
    this.checkCdrVisited();
    this.authMapInit()
    if (this.loggedUsername == "admin" && this.$route.meta.report == "cdr" && this.$route.meta.section == "personal") {
      this.goTo("cdr")
    }
  },
  methods: {
    selectReport(report) {
      this.selectedReport = report;
      this.set("selectedReport", report);
    },
    isActive(route, parent) {
      return parent
        ? route == this.$route.meta.parent
        : route == this.$route.path;
    },
    isTag(route) {
      return this.taggedRoutes.indexOf(route) > -1;
    },
    clearText() {
      this.search = "";
    },
    handlePropagation(event) {
      event.stopPropagation();
    },
    checkCdrVisited() {
      if (!this.cdrVisited && this.$route.meta.report == "cdr") {
        this.cdrVisited = true;
        this.set("cdrVisited", true);
      }
    },
    goTo(report) {
      this.$router.push({ path: `/${report}` })
      this.selectReport(report)
    },
    async authMapInit() {
      const authMap = await this.getAuthMap()
      this.authMap.CdrPbx = authMap.data.cdr_pbx
      this.authMap.CdrPersonal = authMap.data.cdr_personal
      this.authMap.Queues = authMap.data.queues
      if (
        (!authMap.data.queues && this.$route.meta.report == "queue") ||
        (!authMap.data.cdr_pbx && authMap.data.cdr_personal && this.$route.meta.report == "cdr" && this.$route.meta.section == "pbx")
      ) {
        this.goTo("cdr")
      } else if (!authMap.data.cdr_pbx && !authMap.data.cdr_personal && this.$route.meta.report == "cdr") {
        this.goTo("queue")
      }
    }
  },
};
</script>

<style lang="scss" scoped>
@import "../styles/theming.scss";

.menu {
  text-align: left;
}

.block {
  display: inline !important;
}

.icon {
  cursor: pointer !important;
}

.report-switch-row {
  height: 65px !important;
  display: flex !important;
  width: 100%;

  .report-switch-container {
    display: flex;
    align-items: center;
    width: 100%;

    .dropdown {
      .text {
        font-size: 17px;
        font-weight: 600;
      }

      .icon {
        float: right;
        margin-right: 3px !important;
        margin-top: 1px !important;
        font-size: 17px !important;
      }
    }
  }

  .menu {
    margin-top: 10px !important;
    width: 100%;
  }
}

.press-enter {
  color: rgb(53, 189, 178);
  float: right;
}

.dot {
  height: 10px;
  width: 10px;
  background-color: #f2711c;
  border-radius: 50%;
  display: inline-block;
  margin-top: 5px;
}

.dot-small {
  height: 8px;
  width: 8px;
  background-color: #f2711c;
  border-radius: 50%;
  display: inline-block;
  margin-top: 5px;
  margin-right: 17px;
}

.semantic-ui.icon img {
  height: 12px;
}

#docs-menu {
  z-index: 51;

  @media only screen and (max-width: $mobile-bound) {
    & {
      top: 40px !important;
    }
  }
}

#docs-menu:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);
}

#docs-menu::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0);
}

#docs-menu::-webkit-scrollbar-track {
  background-color: rgba(255, 255, 255, 0);
}

.align-left {
  float: left !important;
}

.no-margin-left {
  margin-left: 0px !important;
}

.ui.inverted.menu .link.item:active,
.ui.inverted.menu a.item.active {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #fff !important;
}

#docs-menu {
  @media only screen and (max-width: $mobile-bound) {
    & {
      transform: translateX(-270px);
    }
  }
}

.menu-item-color {
  color: rgba(0, 0, 0, 0.87) !important;
}

.ui.menu .ui.dropdown .menu>.item.report-select {
  padding: 0 !important;
}

.report-link {
  padding: .78571429em 1.14285714em !important;
  display: inline-block;
  width: 100%;
  height: 100%;
}
</style>
