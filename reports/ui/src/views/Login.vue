<template lang="html">
  <div class="flex min-h-full background">
    <div
      class="flex flex-1 flex-col justify-center py-12 px-4 background sm-px-6 lg-flex-none lg-px-20 xl-px-24"
    >
      <div class="mx-auto w-full max-w-sm lg-w-96">
        <div class="flex flex-col items-center justify-center">
          <img :src="loginLogoSrc" alt="logo" class="login-logo" />
          <div class="items-center brandColor">
            {{ reportSubtitle }}
          </div>
        </div>
        <div class="mt-8">
          <div class="mt-6">
            <sui-form
              v-on:submit.prevent="doLogin()"
              :error="error"
              :warning="sessionExpired"
              class="space-y-6"
            >
              <sui-form-field>
                <label class="fixedWeight block text-left" for="username">
                  {{ $t("login.user") }}
                </label>
                <sui-input
                  id="username"
                  type="text"
                  placeholder=""
                  v-model="username"
                />
              </sui-form-field>
              <sui-form-field class="fixedWeight block text-left">
                <label class="fixedWeight" for="password">
                  {{ $t("login.password") }}
                </label>
                <sui-input
                  id="password"
                  type="password"
                  placeholder=""
                  v-model="password"
                />
              </sui-form-field>
              <sui-message v-if="error === 'invalid_credentials'" error>
                <sui-message-header>
                  <i class="exclamation triangle icon"></i>
                  {{ $t("login.invalid_credentials") }}
                </sui-message-header>
                <p>{{ $t("login.invalid_user_pass_try") }}.</p>
              </sui-message>
              <sui-message v-if="error === 'enterprise_version'" error>
                <sui-message-header>
                  <i class="exclamation triangle icon"></i>
                  {{ $t("login.enterprise_version_title") }}
                </sui-message-header>
                <p>{{ $t("login.enterprise_version_message") }}.</p>
              </sui-message>
              <sui-message warning>
                <sui-message-header>
                  <i class="exclamation triangle icon"></i>
                  {{ $t("login.session_expired") }}
                </sui-message-header>
                <p>{{ $t("login.login_again") }}.</p>
              </sui-message>
              <sui-button class="buttonLogin" fluid>
                {{ $t("menu.login") }}
                <sui-loader :active="loading" inline inverted size="tiny" />
              </sui-button>
            </sui-form>
          </div>
        </div>
      </div>
    </div>
    <div class="relative hidden w-0 flex-1 lg-block">
      <sui-image
        :src="loginBackgroundSrc"
        class="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  </div>
</template>

<script>
import LoginService from "../services/login";
import StorageService from "../services/storage";

export default {
  name: "Login",
  data() {
    return {
      username: "",
      password: "",
      error: false,
      loading: false,
      sessionExpired: false,
    };
  },
  mixins: [LoginService, StorageService],
  computed: {
    loginLogoSrc() {
      return this.$root.config.LOGIN_LOGO_URL || "login_logo_dark.svg";
    },
    loginBackgroundSrc() {
      return this.$root.config.LOGIN_BACKGROUND_URL || "LoginBackground.png";
    },
    reportSubtitle() {
      return "Report";
    },
  },
  mounted() {
    this.$root.$on("logout", this.onLogout);
  },
  methods: {
    onLogout() {
      this.sessionExpired = true;
    },
    doLogin() {
      this.loading = true;
      this.sessionExpired = false;

      // remove domain (if any)
      const username = this.username.split("@")[0];

      this.execLogin(
        {
          username: username,
          password: this.password,
        },
        (success) => {
          this.loading = false;
          this.error = false;

          // extract loggedUser info
          var loggedUser = success.body;
          loggedUser.username = username;

          // save to localstorage
          this.set("loggedUser", loggedUser);
          this.username = "";
          this.password = "";

          // change route
          this.$parent.didLogin();
        },
        (error) => {
          this.loading = false;

          // show errors
          if (
            error.body.message ===
            "Reports available only on Enterprise version"
          ) {
            this.error = "enterprise_version";
          } else {
            this.error = "invalid_credentials";
          }

          // print error
          console.error(error.body);
        }
      );
    },
  },
};
</script>

<style lang="css" scoped>
.background {
  background-color: #1b1c1d;
}

.text-left {
  text-align: left;
}

.buttonLogin {
  background: #059669 !important;
  color: white !important;
  margin-top: 30px !important;
  padding-left: 14px !important; /* 16px */
  padding-right: 14px !important; /* 16px */
  padding-top: 9.5px !important; /* 8px */
  padding-bottom: 9.5px !important; /* 8px */
}

.w-0 {
  width: 0px;
}
.inset-0 {
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
.h-5 {
  height: 20px;
}

.flex-1 {
  flex: 1 1 0%;
}

.py-12 {
  padding-top: 48px;
  padding-bottom: 48px;
}

.px-4 {
  padding-left: 16px; /* 16px */
  padding-right: 16px; /* 16px */
}
.w-5 {
  width: 20px;
}

.brandColor {
  color: #059669 !important;
  padding-top: 10px;
  font-size: 16px;
}

.login-logo {
  max-height: 70px;
  width: auto;
  object-fit: contain;
}

.flex {
  display: flex;
}

.fixedWeight {
  font-weight: 400 !important;
  color: #f9fafb !important;
}
.relative {
  position: relative;
}

.block {
  display: block;
}
.flex-col {
  flex-direction: column;
}

.justify-center {
  justify-content: center;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.space-y-6 {
  margin-top: 24px;
}
.mt-6 {
  margin-top: 24px; /* 24px */
}
.mt-8 {
  margin-top: 32px; /* 32px */
}
.max-w-sm {
  max-width: 384px;
}

.absolute {
  position: absolute;
}

.min-h-full {
  height: 100vh;
}
.h-full {
  height: 100%;
}

.w-full {
  width: 100%;
}

.object-cover {
  object-fit: cover;
}

.items-center {
  align-items: center;
}

.hidden {
  display: none;
}

@media (max-width: 420px) {
  .min-h-full {
    height: 120vh;
  }
}
/* sm */
@media (min-width: 640px) {
  .sm-px-6 {
    padding-left: 24px; /* 24px */
    padding-right: 24px; /* 24px */
  }
}

/* md */
@media (min-width: 768px) {
}

/* lg */
@media (min-width: 1024px) {
  .w-lg {
    width: 384px;
  }

  .lg-block {
    display: block;
  }

  .lg-px-20 {
    padding-left: 80px /* 80px */;
    padding-right: 80px /* 80px */;
  }
  .lg-flex-none {
    flex: none;
  }
  .lg-w-96 {
    width: 384px;
  }
}

/* xl */
@media (min-width: 1280px) {
  .xl-px-24 {
    padding-left: 96px; /* 96px */
    padding-right: 96px; /* 96px */
  }
}
</style>
