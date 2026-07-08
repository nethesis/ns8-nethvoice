<template>
  <div class="ui search">
    <sui-input
      :placeholder="placeholder"
      v-model="query"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
    <div
      v-show="results.length && showResults"
      :class="['results', 'transition', showResults ? 'visible' : 'hidden']"
    >
      <div
        v-for="(result, i) in results"
        :key="i"
        class="result"
        @click="selectResult(result)"
      >
        <div class="content">
          <div class="title">
            {{ result.title }}
            <span v-if="showOptionType">
              {{ result.type ? "(" + $t("search." + result.type) + ")" : "" }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    options: {
      type: Array,
      required: true,
    },
    minCharacters: {
      type: Number,
      required: false,
      default: 1,
    },
    maxResults: {
      type: Number,
      required: false,
      default: 100,
    },
    searchFields: {
      type: Array,
      required: false,
      default: function () {
        return ["title"];
      },
    },
    showOptionType: {
      type: Boolean,
      required: false,
      default: true,
    },
    placeholder: {
      type: String,
      required: false,
      default: "",
    },
  },
  data() {
    return {
      query: "",
      results: [],
      showResults: false,
    };
  },
  methods: {
    search() {
      // clean query
      const cleanRegex = /[^a-zA-Z0-9]/g;
      const queryText = this.query.replace(cleanRegex, "");

      if (queryText.length < this.minCharacters) {
        this.results = [];
        this.showResults = false;
        return;
      }

      // search
      this.results = this.options.filter((option) => {
        // compare query text with all search fields of option
        return this.searchFields.some((searchField) => {
          if (option[searchField]) {
            return new RegExp(queryText, "i").test(
              option[searchField].replace(cleanRegex, "")
            );
          } else {
            return false;
          }
        });
      }, this);

      if (this.results.length) {
        // limit maximum number of results
        if (this.results.length > this.maxResults) {
          this.results = this.results.slice(0, this.maxResults);
        }

        // if query matches exactly the title of a result, select it
        for (const result of this.results) {
          if (this.query == result.title) {
            this.$emit("select", result);
          }
        }

        this.showResults = true;
      } else {
        this.showResults = false;
      }
    },
    onInput(event) {
      this.$emit("input", event);
      this.search();
    },
    onFocus() {
      this.search();
    },
    onBlur() {
      this.$emit("blur");

      setTimeout(() => {
        this.showResults = false;
      }, 300);
    },
    selectResult(result) {
      this.query = result.title;
      this.$emit("input", this.query);
      this.$emit("select", result);
      this.showResults = false;
    },
  },
};
</script>

<style lang="scss" scoped>
.results {
  overflow: auto;
  max-height: 19rem;
}
</style>