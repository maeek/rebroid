import { createNoInputAction } from '../shared/definition-builders'

export const clearBlockedCidrsAction = createNoInputAction({
  uses: 'container.network.clearBlockedCidrs',
  category: 'Network',
  iconKey: 'shield'
})
