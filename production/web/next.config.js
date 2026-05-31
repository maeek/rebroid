/** @type {import('next').NextConfig} */
const apkUploadBodySizeLimit =
  process.env.NEXT_SERVER_ACTIONS_BODY_SIZE_LIMIT || process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE || '512mb'

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // The display sidecar serves the viewer directly. Keep slash normalization
  // disabled so legacy same-origin viewer tokens do not trigger redirect loops.
  skipTrailingSlashRedirect: true,
  experimental: {
    proxyClientMaxBodySize: apkUploadBodySizeLimit,
    serverActions: {
      bodySizeLimit: apkUploadBodySizeLimit
    }
  },
  compiler: {
    styledComponents: true
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value:
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
        },
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
      }
    ]
  }
}

module.exports = nextConfig
