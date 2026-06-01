/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-orchestrator-http-from-domain',
      severity: 'error',
      from: { path: '^apps/orchestrator/src/(android-apps|apk)/.+/(services|utils)/' },
      to: { path: '/controllers/' }
    }
  ],
  options: {
    exclude: '(^|/)(node_modules|\\.next|dist)(/|$)',
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'apps/orchestrator/tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.mjs'] }
  }
}
