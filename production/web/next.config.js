/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  i18n: {
    locales: ['en', 'pl'],
    defaultLocale: 'en'
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
