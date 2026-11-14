import { createNoInputAction } from '../shared/definition-builders'

export const resetPolicyAction = createNoInputAction({
  uses: 'container.network.resetPolicy',
  category: 'Network',
  iconKey: 'route',
  noInputMessage: 'Enables restrictions and clears the custom allowlist.'
})
