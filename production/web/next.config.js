/** @type {import('next').NextConfig} */
const apkUploadBodySizeLimit =
  process.env.NEXT_SERVER_ACTIONS_BODY_SIZE_LIMIT || process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE || '4096mb'

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
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
