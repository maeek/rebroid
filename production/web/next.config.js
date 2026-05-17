/** @type {import('next').NextConfig} */
const apkUploadBodySizeLimit =
  process.env.NEXT_SERVER_ACTIONS_BODY_SIZE_LIMIT || process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE || '512mb'
const wsScrcpyInternalBaseUrl = (process.env.WS_SCRCPY_INTERNAL_BASE_URL || 'http://sma-ws-scrcpy:8000').replace(
  /\/$/,
  ''
)

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: apkUploadBodySizeLimit,
    serverActions: {
      bodySizeLimit: apkUploadBodySizeLimit
    }
  },
  allowedDevOrigins: ['192.168.1.12'],
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
