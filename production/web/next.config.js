/** @type {import('next').NextConfig} */
const apkUploadBodySizeLimit =
  process.env.NEXT_SERVER_ACTIONS_BODY_SIZE_LIMIT || process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE || '4096mb'
const wsScrcpyInternalBaseUrl = (process.env.WS_SCRCPY_INTERNAL_BASE_URL || 'http://rebroid-ws-scrcpy:8000').replace(
  /\/$/,
  ''
)

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // ws-scrcpy serves its static viewer from an Express directory mount and
  // requires the trailing slash. Next's slash normalization can otherwise loop
  // between /viewer/ws-scrcpy and /viewer/ws-scrcpy/.
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
  },
  rewrites: async () => {
    if (!wsScrcpyInternalBaseUrl) {
      return []
    }

    return [
      {
        source: '/viewer/ws-scrcpy/:path*',
        destination: `${wsScrcpyInternalBaseUrl}/viewer/ws-scrcpy/:path*`
      }
    ]
  }
}

module.exports = nextConfig
