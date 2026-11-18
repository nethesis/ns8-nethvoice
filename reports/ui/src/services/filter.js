var FilterService = {
  methods: {
    getDefaultFilter(success, error) {
      this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/filters",
          {
            headers: {
              Authorization:
                "Bearer " +
                (this.get("loggedUser") && this.get("loggedUser").token) ||
                "",
            },
          }
        )
        .then(success, error);
    },
    getFilterField(field, success, error) {
      this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/filters/" + field,
          {
            headers: {
              Authorization:
                "Bearer " +
                (this.get("loggedUser") && this.get("loggedUser").token) ||
                "",
            },
          }
        )
        .then(success, error);
    }
  },
};
export default FilterService;
