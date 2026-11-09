var CdrDetailsService = {
  methods: {
    getCdrDetails(linkedId, success, error) {
      this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/details/" + linkedId,
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
export default CdrDetailsService;