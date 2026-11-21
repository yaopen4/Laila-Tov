
import type {NextConfig} from 'next';

const isDev = process.env.NODE_ENV === 'development';
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

/**
 * A production deploy built in emulator mode would point every browser at
 * localhost and accept unsigned session cookies for demo- projects. Refuse to build
 * it on Netlify (which sets NETLIFY=true), where it can only be a misconfiguration.
 */
if (process.env.NETLIFY === 'true' && useEmulators) {
  throw new Error(
    'NEXT_PUBLIC_USE_EMULATORS is "true" in a Netlify build. Set it to "false" and provide ' +
      'the real NEXT_PUBLIC_FIREBASE_* values in Site configuration > Environment variables.'
  );
}

/**
 * Content-Security-Policy.
 *
 * script-src keeps 'unsafe-inline' because the App Router injects inline bootstrap
 * scripts and the pages are statically prerendered (nonces need per-request
 * rendering). The policy still blocks the things that matter most here: loading
 * script from any other origin, sending data anywhere but Firebase, and framing.
 */
function contentSecurityPolicy(): string {
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const connect = [
    "'self'",
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firestore.googleapis.com',
  ];
  if (useEmulators) {
    for (const host of [
      process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST ?? 'localhost:9099',
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? 'localhost:8080',
    ]) {
      connect.push(`http://${host}`, `ws://${host}`);
    }
  }
  if (isDev) connect.push('ws:', 'wss:'); // hot reload

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://placehold.co",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    `frame-src 'self'${authDomain ? ` https://${authDomain}` : ''}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

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
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
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
