const js = require('@eslint/js')
const { FlatCompat } = require('@eslint/eslintrc')

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

module.exports = [
  { ignores: ['.next/**', '.eslintrc.js', '.prettierrc.js', 'eslint.config.cjs', 'next-env.d.ts', 'node_modules/**'] },
  ...compat.config(require('./.eslintrc.js'))
]
