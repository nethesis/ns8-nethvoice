var PhonebookService = {
  methods: {
    getPhonebook(success, error) {
      this.$http
        .get(
          this.$root.apiScheme + this.$root.apiEndpoint + "/phonebook",
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
export default PhonebookService;
