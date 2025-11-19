<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>proxy step</div>
</template>

<script>
import {
  UtilService,
  TaskService,
  IconService,
  LottieService,
} from "@nethserver/ns8-ui-lib";
import { mapState } from "vuex";

//// review

export default {
  name: "ProxyStep",
  mixins: [UtilService, TaskService, IconService, LottieService],
  props: {
    ////
  },
  data() {
    return {
      loading: {
        ////
      },
      error: {
        ////
      },
    };
  },
  computed: {
    ...mapState(["core"]),
  },
  watch: {
    ////
  },
  created() {
    console.log("created OpenldapStep"); ////

    // this.listUserDomains(); ////
  },
  methods: {
    next() {
      console.log("next, proxy step"); ////

      ////
      // if (this.accountProviderType == "create_openldap") {
      //   this.$emit("set-step", OPENLDAP_STEP);
      // } else {
      //   if (!this.isProxyInstalled) {
      //     this.$emit("set-step", INSTALL_PROXY_STEP);
      //   } else {
      //     this.$emit("set-step", CONFIGURE_OR_SHOW_PROXY);
      //   }
      // }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
