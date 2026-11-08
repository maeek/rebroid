import { applicationPreview } from '@/shared/testing/application-preview'

const names = [
  'Inventory worker',
  'Warehouse scanner with a very long application name',
  'Checkout terminal',
  'Delivery tracker',
  'Support kiosk',
  'Stock room',
  'Order picker',
  'Field service'
]

export const galleryPreviewApplications = names.map((name, index) => ({
  ...applicationPreview,
  id: `gallery-app-${index}`,
  name,
  status: { ...applicationPreview.status, currentStatus: index === 0 ? ('error' as const) : ('stopped' as const) },
  ownerUserId: index === 7 ? 'another-owner' : applicationPreview.ownerUserId
}))
