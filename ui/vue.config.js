module.exports = {
  publicPath: "./",
  configureWebpack: {
    optimization: {
      splitChunks: {
        minSize: 10000,
        maxSize: 250000,
      },
    },
  },
  chainWebpack: (config) => {
    config.module
      .rule("images")
      .use("url-loader")
      .loader("url-loader")
      .tap((options) => {
        // Do not base64 encode images URLs. Needed to always generate module logo image
        options.limit = -1;
        return options;
      });
  },
  // added to fix the build of https://github.com/nethesis/ns8-nethvoice/pull/756
  transpileDependencies: ["generate-password-lite"],
};
