<template>
  <button
    v-if="isVisible"
    class="goTop"
    :class="{ isVisible: isVisible }"
    href="#"
    v-scroll-to="{
      el: '.topbar',
      container: '.docs-container',
      duration: 300,
      easing: 'linear',
      force: true,
      cancelable: true,
      x: false,
      y: true
    }"
  >
    <i class="angle up icon"></i>
  </button>
</template>

<script>

export default {
  name: "BackToTop",
  props: [
    "scrollTop"
  ],
  data: function() {
    return {
      isVisible: false
    };
  },
  methods: {
    scrollHandler(evt) {
      if (evt.target.attributes["views-wrapper"]) {
        if (evt.target.scrollTop >= this.scrollTop) {
          this.isVisible = true
        } else {
          this.isVisible = false
        }
      }
    }
  },
  mounted: function() {
    this.$nextTick(() => {
      window.addEventListener('scroll', this.scrollHandler, true)
    })
  },
  destroyed() {
    window.removeEventListener('scroll', this.scrollHandler);
  },
}

</script>

<style lang="scss" scoped>
.goTop {
  border-radius: 5px;
  background-color: rgb(1,14,27);
  background-color: rgba(1, 14, 27, .7);
  position: fixed;
  width: 45px;
  height: 45px;
  display: block;
  right: 23px;
  bottom: 18px;
  border: none;
  opacity: 0;
  z-index: -1;
  cursor: pointer;

  i {
    color: white;
    font-size: 22px !important;
    margin-left: 4px !important;
  }
  .fa {
    color: white;
    font-size: 22px;
  }
  &:hover {
    opacity: 1;
    background-color: rgb(1,14,27);
    background-color: rgba(1, 14, 27, .9);
  }
}

.isVisible {
  opacity: .8;
  z-index: 4;
  transition: all .4s ease-in;
}
</style>