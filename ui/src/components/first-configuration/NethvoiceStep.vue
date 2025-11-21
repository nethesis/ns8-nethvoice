<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>nethvoice step</div>
</template>

<script>
import {
  UtilService,
  TaskService,
  IconService,
  LottieService,
} from "@nethserver/ns8-ui-lib";
import { mapState } from "vuex";
import to from "await-to-js";

//// review

export default {
  name: "NethvoiceStep",
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
    ...mapState(["core", "instanceStatus", "defaults"]),
  },
  watch: {
    ////
  },
  methods: {
    ////
  },
};
</script>

<style scoped lang="scss">
@import "../../styles/carbon-utils";
</style>
