import { createNoInputAction } from '../shared/definition-builders'

export const resetPolicyAction = createNoInputAction({
  uses: 'container.network.resetPolicy',
  category: 'Network',
  iconKey: 'route'
})
