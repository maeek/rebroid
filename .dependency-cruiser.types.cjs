const base = require('./.dependency-cruiser.cjs')

module.exports = {
  forbidden: base.forbidden.filter(rule =>
    ['no-web-shared-ui-to-feature', 'no-web-shared-ui-to-server', 'no-web-shared-model-to-server'].includes(rule.name)
  ),
  options: {
    ...base.options,
    tsPreCompilationDeps: true
  }
}
