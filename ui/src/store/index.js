//
// Copyright (C) 2023 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later
//
import Vue from "vue";
import Vuex from "vuex";
import firstConfiguration from "./modules/firstConfiguration";

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    firstConfiguration,
  },
  state: {
    appName: "",
    instanceName: "",
    instanceLabel: "",
    core: null,
    isAppConfigured: true,
    isShownFirstConfigurationModal: false,
    configuration: null,
    instanceStatus: null,
    defaults: null,
  },
  mutations: {
    setInstanceName(state, instanceName) {
      state.instanceName = instanceName;
    },
    setInstanceLabel(state, instanceLabel) {
      state.instanceLabel = instanceLabel;
    },
    setCore(state, core) {
      state.core = core;
    },
    setAppName(state, appName) {
      state.appName = appName;
    },
    setAppConfigured(state, value) {
      state.isAppConfigured = value;
    },
    setConfiguration(state, configuration) {
      state.configuration = configuration;
    },
    setInstanceStatus(state, status) {
      state.instanceStatus = status;
    },
    setDefaults(state, defaults) {
      state.defaults = defaults;
    },
    setShownFirstConfigurationModal(state, value) {
      state.isShownFirstConfigurationModal = value;
    },
  },
  actions: {
    setInstanceNameInStore(context, instanceName) {
      context.commit("setInstanceName", instanceName);
    },
    setInstanceLabelInStore(context, instanceLabel) {
      context.commit("setInstanceLabel", instanceLabel);
    },
    setCoreInStore(context, core) {
      context.commit("setCore", core);
    },
    setAppNameInStore(context, appName) {
      context.commit("setAppName", appName);
    },
    setAppConfiguredInStore(context, value) {
      context.commit("setAppConfigured", value);
    },
    setConfigurationInStore(context, configuration) {
      context.commit("setConfiguration", configuration);
    },
    setInstanceStatusInStore(context, status) {
      context.commit("setInstanceStatus", status);
    },
    setDefaultsInStore(context, defaults) {
      context.commit("setDefaults", defaults);
    },
    setShownFirstConfigurationModalInStore(context, value) {
      context.commit("setShownFirstConfigurationModal", value);
    },
  },
});
