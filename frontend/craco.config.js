// frontend/craco.config.js
const webpack = require('webpack');
const path = require('path'); // Import path module

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add fallbacks for Node.js core modules
      // This is necessary for dependencies like 'dotenv' that might try to use Node.js modules in the browser.
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback, // Keep existing fallbacks if any
        "fs": false, // File system access is not possible in the browser
        "path": require.resolve("path-browserify"), // Use browserify polyfill for path
        "os": require.resolve("os-browserify/browser"), // Use browserify polyfill for os
        // Add other polyfills if needed by other dependencies
        "crypto": require.resolve("crypto-browserify"), // Use browserify polyfill for crypto
        "stream": require.resolve("stream-browserify"), // Often needed with crypto or other libs
        "buffer": require.resolve("buffer/"), // Use buffer polyfill
         // 'process' is often needed, but the ProvidePlugin below is the standard way to handle it.
         // Adding 'process': require.resolve('process/browser') here is also an option.
      };

      // Add the ProvidePlugin to make Buffer and process available globally
      // This is required by some polyfills and libraries that expect these globals.
      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
         // Add other necessary plugins if any
      ];

      // Ensure node config is not overriding fallbacks (shouldn't be necessary but as a check)
      // In Webpack 5, setting resolve.fallback is the primary method.
      if (webpackConfig.node) {
         // Delete or set specific node polyfills to false if they conflict
         // webpackConfig.node = { ...webpackConfig.node, global: false }; // Example
         delete webpackConfig.node; // Often safest to delete node polyfill settings entirely in browser builds
      }


      // Optional: Configure aliasing if needed (e.g. for specific libs)
      // webpackConfig.resolve.alias = { ... };

      // Return the modified webpack config
      return webpackConfig;
    },
  },
  // Keep other sections if needed (jest, devServer)
   jest: {
     configure: (jestConfig) => {
       // Jest configuration overrides (if needed for testing Node.js modules)
        return jestConfig;
     },
   },
   devServer: {
       // Development server configuration overrides (e.g. for proxying API requests)
       // This is an alternative to adding "proxy": "http://localhost:5000" in package.json
        // proxy: {
        //     '/api': 'http://localhost:5000', // Example: Proxy API requests to your backend
        // },
       // You can also add headers here if needed for CORS or other purposes
       // headers: { "Access-Control-Allow-Origin": "*" }
   },
};