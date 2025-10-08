/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable caching in development to prevent stale data issues
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 25 * 1000,
      // number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 2,
    },
  }),

  // Experimental features for better development experience
  experimental: {
    // Enable faster refresh
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Better error handling
    serverComponentsExternalPackages: ['better-sqlite3'],
  },

  // Webpack configuration for better caching
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Disable webpack cache in development to prevent stale modules
      config.cache = false;
      
      // Add cache busting for better HMR
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.next/**'],
      };
    }

    // Handle SQLite properly
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Headers for better caching control
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },

  // Redirects for better UX
  async redirects() {
    return [
      {
        source: '/book-loads',
        destination: '/find-loads',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
