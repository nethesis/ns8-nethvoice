<template>
  <div id="mobile-menu" class="ui fixed inverted main menu">
    <div class="ui container">
      <a @click="toggleSidebar()" class="launch icon item">
        <i v-if="!sidebarShown" class="content icon"></i>
        <i v-if="sidebarShown" class="arrow left icon"></i>
      </a>
    </div>
  </div>
</template>

<script>

export default {
  name: "MobileTopBar",
  data: function() {
    return {
      isVisible: false,
      sidebarShown: false
    };
  },
  mounted() {
    this.$root.$on("sidebarHide", this.onSidebarHide);
  },
  methods: {
    onSidebarHide() {
      this.sidebarShown = false;
    },
    toggleSidebar() {
      let sidebar = document.querySelector("#docs-menu")
      if (sidebar.style.transform == "translateX(0px)") {
        sidebar.style.transform = "translateX(-270px)"
        this.sidebarShown = false
      } else {
        sidebar.style.transform = "translateX(0px)"
        this.sidebarShown = true
      }
    }
  }
}

</script>

<style lang="scss" scoped>

@import "../styles/theming.scss";

#mobile-menu {
  .ui.container {
    margin: 0px !important;
  }

  @media only screen and (min-width: $mobile-bound) {
    & {
      display: none;
    }
  }
}

</style>