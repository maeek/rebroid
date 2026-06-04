import { createNoInputAction } from '../shared/definition-builders'

export const clearAllowedCidrsAction = createNoInputAction({
  uses: 'container.network.clearAllowedCidrs',
  category: 'Network',
  iconKey: 'network'
})
