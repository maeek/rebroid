/** @type {import('next').NextConfig} */
const apkUploadBodySizeLimit = process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE || '512mb'
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: { position: 'bottom-right' },
  // Server Function traces include raw arguments such as login passwords.
  logging: { serverFunctions: false },
  allowedDevOrigins,
  output: 'standalone',
  // The display sidecar serves the viewer directly. Keep slash normalization
  // disabled so same-origin viewer routes do not trigger redirect loops.
  skipTrailingSlashRedirect: true,
  experimental: {
    proxyClientMaxBodySize: apkUploadBodySizeLimit,
    serverActions: {
      bodySizeLimit: process.env.NEXT_SERVER_ACTIONS_BODY_SIZE_LIMIT || '4mb'
    }
  },
  headers: async () => [
    ...(process.env.NODE_ENV === 'production'
      ? [
          {
            source: '/illustrations/:file',
            headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }]
          }
        ]
      : []),
    {
      source: '/:path*',
      headers: [
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
      ]
    }
  ],
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/apps',
        permanent: true
      },
      {
        source: '/devices/external',
        destination: '/devices',
        permanent: false
      },
      {
        source: '/devices/:slug((?!new$|external$)[^/]+)',
        destination: '/apps/:slug',
        permanent: false
      },
      {
        source: '/devices/new',
        has: [{ type: 'query', key: 'kind', value: 'managed' }],
        destination: '/apps/new',
        permanent: false
      },
      {
        source: '/security/network-policies',
        destination: '/security/firewall',
        permanent: true
      },
      {
        source: '/platform/services/display-sessions',
        destination: '/platform/casting',
        permanent: true
      }
    ]
  }
}

module.exports = nextConfig
