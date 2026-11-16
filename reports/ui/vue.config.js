module.exports = {
  publicPath:
    process.env.NODE_ENV === "production" ? "" : "",
  // jspdf 3+ depends on fast-png and iobuffer, which ship ES2022 syntax
  // (class fields): webpack 4 cannot parse it, so let Babel transpile them.
  transpileDependencies: ["fast-png", "iobuffer"],
  chainWebpack: config => {
    // markdown loader
    config.module.rule('md')
      .test(/\.md$/)
      .use()
      .loader('raw-loader')
        .end()
  },
};
