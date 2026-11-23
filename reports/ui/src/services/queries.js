var QueriesService = {
  methods: {
    execQuery(filter, report, section, view, graph, queryType, success, error) {
      this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/graph/" + report + "/" + section + "/" + view+ "?filter=" + encodeURIComponent(JSON.stringify(filter)) + "&graph=" + graph + "&type=" + queryType,
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
    getQueryTree(report, success, error) {
      this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/query_tree/" + report,
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
export default QueriesService;
