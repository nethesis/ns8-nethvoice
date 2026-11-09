var SearchesService = {
  methods: {
    getSearches(report, success, error) {
      this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/searches/" + report,
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
    createSearch(report, body, success, error) {
      this.$http
        .post(this.$root.apiScheme + this.$root.apiEndpoint + "/searches/" + report, body,
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
    deleteSearch(report, searchId, success, error) {
      this.$http
        .delete(this.$root.apiScheme + this.$root.apiEndpoint + "/searches/" + report + "/" + searchId,
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
  },
};
export default SearchesService;
