// workaround for ESM module loader errors
// see https://github.com/vercel/next.js/issues/25454
let withSentryConfig
try {
  withSentryConfig = require('@sentry/nextjs').withSentryConfig
} catch (e) {
  withSentryConfig = (config) => config
}

let withTM
try {
  withTM = require('next-transpile-modules')([
    '@project-serum/anchor',
    '@solana/web3.js',
    '@solana/spl-token',
    '@blockworks-foundation/mango-v4',
    '@switchboard-xyz/sbv2-lite',
    '@solendprotocol/solend-sdk',
    '@coral-xyz/anchor',
    '@project-serum/common',
    '@mean-dao/payment-streaming',
    '@sqds/mesh'
  ])
} catch (e) {
  withTM = (config) => config
}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

// Import webpack
const webpack = require('webpack')

let config

// STEP 1: Add transpiler.
config = withTM({
  output: 'standalone',
  // Increase static generation timeout to 5 minutes
  staticPageGenerationTimeout: 300,
  // Skip static generation during build if SKIP_STATIC_GEN is set
  experimental: {
    // This will make getStaticProps return null during build if SKIP_STATIC_GEN is true
    skipTrailingSlashRedirect: true,
    skipMiddlewareUrlNormalize: true,
  },
  webpack: (config, { isServer, dev }) => {
    config.experiments = { asyncWebAssembly: true, layers: true }
    
    // Handle Node.js built-in modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        url: require.resolve('url'),
        zlib: require.resolve('browserify-zlib'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        assert: require.resolve('assert'),
        os: require.resolve('os-browserify'),
        path: require.resolve('path-browserify'),
        'process/browser': require.resolve('process/browser'),
        buffer: require.resolve('buffer/'),
        util: require.resolve('util/'),
      }

      // Add Buffer polyfill
      config.plugins = config.plugins || []
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      )
    }

    // Optimize production builds
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      }
    }

    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    return config
  },

  pageExtensions: ['mdx', 'md', 'jsx', 'tsx', 'api.ts'], // .ts files are not pages

  reactStrictMode: true,
  productionBrowserSourceMaps: true,

  env: {
    MAIN_VIEW_SHOW_MAX_TOP_TOKENS_NUM:
      process.env.MAIN_VIEW_SHOW_MAX_TOP_TOKENS_NUM,
    DISABLE_NFTS: process.env.DISABLE_NFTS,
    REALM: process.env.REALM,
    MAINNET_RPC: process.env.MAINNET_RPC,
    DEVNET_RPC: process.env.DEVNET_RPC,
    DEFAULT_GOVERNANCE_PROGRAM_ID: process.env.DEFAULT_GOVERNANCE_PROGRAM_ID,
    // Add build-time flag to skip static generation
    SKIP_STATIC_GEN: process.env.SKIP_STATIC_GEN || 'false',
  },
  //proxy for openserum api cors
  rewrites: async () => {
    return [
      {
        source: '/openSerumApi/:path*',
        destination: 'https://openserum.io/api/serum/:path*',
      },
    ]
  },
})

// STEP 2: Enable bundle analyzer when `ANALYZE=true`.
config = withBundleAnalyzer(config)

// STEP 3: Sentry error reporting (only if SENTRY_AUTH_TOKEN is present)
if (process.env.SENTRY_AUTH_TOKEN) {
  config = withSentryConfig(config, {
    silent: true,
  })
}

module.exports = config