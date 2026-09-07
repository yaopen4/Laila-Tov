
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /**
   * Dev and production builds get separate output directories.
   *
   * `next dev --turbopack` emits Turbopack artifacts; `next build` emits Webpack
   * ones. Sharing `.next` lets them mix, and the resulting production server starts
   * cleanly but returns 500 on every route ("Expected to use Webpack bindings ...
   * referencing Turbopack bindings") -- which reads like an application bug.
   *
   * Separating them removes the interaction: you can build while the dev server runs,
   * and neither disturbs the other.
   */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

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
