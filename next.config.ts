import type { NextConfig } from "next";
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Ensure .next/lock FILE exists before Next.js tries to access it
// Next.js expects .next/lock to be a FILE, not a directory
try {
  const nextDir = join(process.cwd(), '.next');
  mkdirSync(nextDir, { recursive: true });
  const lockFile = join(nextDir, 'lock');
  // Create empty lock file if it doesn't exist
  try {
    writeFileSync(lockFile, '', { flag: 'wx' });
  } catch (e: any) {
    // Ignore if file already exists (EEXIST) or is a directory (EISDIR)
    if (e.code !== 'EEXIST' && e.code !== 'EISDIR') {
      throw e;
    }
  }
} catch (e) {
  // Ignore errors - file might already exist or .next might not be writable yet
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname, // pin tracing to THIS folder
  typescript: {
    ignoreBuildErrors: true,
  },
  // Workaround for Vercel .next/lock error
  experimental: {
    // Disable build lock file to prevent ENOENT errors on Vercel
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Include files that are read at runtime to ensure they're available in the build
    outputFileTracingIncludes: {
      '/**': [
        './db/migrations/**/*.sql',
        './lib/**/*',
        './scripts/**/*',
      ],
    },
  },
  // Suppress dynamic route warnings during build (these are expected for authenticated pages)
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  
  // Disable caching in development to prevent stale data issues
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 25 * 1000,
      // number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 2,
    },
  }),

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Compression
  compress: true,
  
  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    if (dev) {
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

  // Turbopack configuration (empty to silence Next.js 16 warning)
  // We're using webpack config above, so this is just to prevent the build error
  turbopack: {},

  // Headers for caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: process.env.NODE_ENV === 'development' 
              ? 'no-store, max-age=0' 
              : 'public, max-age=30, s-maxage=30',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
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

export default nextConfig;
