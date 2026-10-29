import type { NextConfig } from 'next';
const config: NextConfig = {
  output: process.env.NEXO_STANDALONE === 'true' ? 'standalone' : undefined,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://127.0.0.1:4100'}/api/:path*`,
      },
    ];
  },
};
export default config;
