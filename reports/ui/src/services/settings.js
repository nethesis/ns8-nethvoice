var SettingsService = {
  methods: {
    getSettings(success, error) {
       this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/settings",
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
    getSettingsPromise() {
      return this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/settings",
          {
            headers: {
              Authorization:
                "Bearer " +
                (this.get("loggedUser") && this.get("loggedUser").token) ||
                "",
            },
          }
        )
        .then((response) => {
          return response.body
        }, (error) => {
          console.error(error.body)
        });
   },
    updateSettings(body, success, error) {
      this.$http
        .put(this.$root.apiScheme + this.$root.apiEndpoint + "/settings", body,
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
    deleteSettings(success, error) {
      this.$http
        .delete(this.$root.apiScheme + this.$root.apiEndpoint + "/settings",
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
export default SettingsService;
