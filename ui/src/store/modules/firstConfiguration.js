//
// Copyright (C) 2023 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later
//

//// remove vuex store for first configuration?

// first configuration steps //// remove?
export const SELECT_ACCOUNT_PROVIDER = "selectAccountProvider";
export const INSTALL_OPENLDAP = "installOpenldap";
export const CONFIGURE_OPENLDAP = "configureOpenldap";
export const INSTALL_PROXY = "installProxy";
export const CONFIGURE_OR_SHOW_PROXY = "configureOrShowProxy";
// export const SHOW_PROXY_CONFIG = "showProxyConfig"; ////
export const CONFIGURE_NETHVOICE = "configureNethvoice";

export default {
  namespaced: true,
  state: {
    firstConfigurationStep: SELECT_ACCOUNT_PROVIDER,
    canOpenFirstConfigurationModal: true,
  },
  mutations: {
    setFirstConfigurationStep(state, step) {
      state.firstConfigurationStep = step;
    },
    setCanOpenFirstConfigurationModal(state, value) {
      state.canOpenFirstConfigurationModal = value;
    },
  },
  actions: {
    setFirstConfigurationStepInStore(context, step) {
      context.commit("setFirstConfigurationStep", step);
    },
    setCanOpenFirstConfigurationModalInStore(context, value) {
      context.commit("setCanOpenFirstConfigurationModal", value);
    },
    // goToNextStep(context) { //// remove
    //   const currentStep = context.state.firstConfigurationStep;
    //   let nextStep = null;

    //   switch (currentStep) {
    //     case SELECT_ACCOUNT_PROVIDER:
    //          //// todo perform validation!
    //     //   if (!this.validateSelectAccountProvider()) {
    //     //     return;
    //     //   }

    //       if (this.accountProviderType == "create_openldap") {
    //         this.step = "installingOpenldap";
    //       } else {
    //         // go to proxy step
    //         if (!this.isProxyInstalled) {
    //           this.step = "needToInstallProxy";
    //         } else if (!this.isProxyConfigured) {
    //           this.step = "inputProxyConfig";
    //         } else {
    //           this.step = "proxyAlreadyConfigured";
    //         }
    //       }
    //       break;
    //     case "inputOpenldapConfig":
    //       // validate and configure openldap
    //       this.configureOpenLdap();
    //       break;
    //     case "needToInstallProxy": {
    //       this.step = "installingProxy";
    //       break;
    //     }
    //     case "inputProxyConfig":
    //       // call child method to validate and configure proxy
    //       this.$refs.proxyConfigForm.configureModule();
    //       break;
    //     case "proxyAlreadyConfigured":
    //     case "inputNethvoiceConfig":
    //       //// call child method to validate and configure proxy
    //       this.$refs.nethvoiceConfigForm.configureModule();
    //       // this.step = "configuringNethvoice"; ////
    //       break;
    //   }
  },
};
