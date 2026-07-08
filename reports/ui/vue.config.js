module.exports = {
  publicPath:
    process.env.NODE_ENV === "production" ? "" : "",
  chainWebpack: config => {
    // markdown loader
    config.module.rule('md')
      .test(/\.md$/)
      .use()
      .loader('raw-loader')
        .end()
  },
};
