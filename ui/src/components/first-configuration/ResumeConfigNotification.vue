<!--
  Copyright (C) 2025 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <NsInlineNotification
    kind="warning"
    :title="$t('welcome.configuration_incomplete')"
    :description="$t('welcome.configuration_incomplete_description')"
    :actionLabel="$t('welcome.resume')"
    @action="setShownFirstConfigurationModalInStore(true)"
  />
</template>

<script>
import { mapActions } from "vuex";

export default {
  name: "ResumeConfigNotification",
  data() {
    return {};
  },
  methods: {
    ...mapActions(["setShownFirstConfigurationModalInStore"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../styles/carbon-utils";
</style>
