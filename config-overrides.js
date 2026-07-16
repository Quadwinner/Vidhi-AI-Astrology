const webpack = require('webpack');
const path = require('path');

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
    "process": require.resolve("process/browser.js"),
    // asn1.js optionally requires Node's 'vm'; it's not needed in the browser.
    // Stub it to an empty module so the build doesn't emit a "Can't resolve 'vm'" error.
    "vm": false,
  });
  config.resolve.fallback = fallback;
  
  // Add alias for process/browser to fix ESM module resolution
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    "process/browser": path.resolve(__dirname, "node_modules/process/browser.js"),
  };
  
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: "process/browser.js",
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.NormalModuleReplacementPlugin(
      /^process\/browser$/,
      require.resolve("process/browser.js")
    ),
  ]);
  return config;
};

