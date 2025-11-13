//
// Copyright (C) 2023 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later
//
import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    appName: "",
    instanceName: "",
    instanceLabel: "",
    core: null,
    isAppConfigured: true,
    canOpenFirstConfigurationModal: true,
    configuration: null,
    instanceStatus: null,
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
    setCanOpenFirstConfigurationModal(state, value) {
      state.canOpenFirstConfigurationModal = value;
    },
    setConfiguration(state, configuration) {
      state.configuration = configuration;
    },
    setInstanceStatus(state, status) {
      state.instanceStatus = status;
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
    setCanOpenFirstConfigurationModalInStore(context, value) {
      context.commit("setCanOpenFirstConfigurationModal", value);
    },
    setConfigurationInStore(context, configuration) {
      context.commit("setConfiguration", configuration);
    },
    setInstanceStatusInStore(context, status) {
      context.commit("setInstanceStatus", status);
    },
  },
  modules: {},
});
