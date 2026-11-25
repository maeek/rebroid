import { applicationPreview } from '@/shared/testing/application-preview'
import type { ApplicationGalleryRow } from '@/shared/contracts/application-gallery'

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

export const galleryPreviewApplications: ApplicationGalleryRow[] = names.map((name, index) => ({
  id: `gallery-app-${index}`,
  kind: applicationPreview.kind,
  operations: applicationPreview.operations,
  name,
  status: index === 0 ? 'error' : 'stopped',
  lifecycleStage: applicationPreview.status.lifecycleStage,
  ownerUserId: index === 7 ? 'another-owner' : applicationPreview.ownerUserId,
  ownerDisplayName: index === 7 ? 'Operations team' : 'You',
  containerImage: applicationPreview.runtime.image,
  apkPackageName: applicationPreview.apk.packageName,
  updatedAt: applicationPreview.updatedAt
}))
