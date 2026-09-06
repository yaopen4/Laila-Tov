
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // These were both `true`, which is why a codebase full of references to
  // undefined types and non-existent functions still built cleanly. Type errors
  // are the cheapest bugs to catch; let them fail the build.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
