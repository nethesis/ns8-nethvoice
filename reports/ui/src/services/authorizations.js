const AuthService = {
  methods: {
    getAuthModified() {
      return this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/authorizations/stats",
          {
            headers: {
              Authorization:
                "Bearer " +
                (this.get("loggedUser") && this.get("loggedUser").token) ||
                "",
            },
          }
        )
    },
    getAuthMap() {
      return this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/authorizations/map",
          {
            headers: {
              Authorization:
                "Bearer " +
                (this.get("loggedUser") && this.get("loggedUser").token) ||
                "",
            },
          }
        )
    },
  },
};
export default AuthService;
