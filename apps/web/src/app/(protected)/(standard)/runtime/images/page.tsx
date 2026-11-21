import { RuntimeImagesPageEntry } from '@/features/platform/pages/runtime-images/page-entry'
import type { PlatformGridSearchParams } from '@/features/platform/pages/platform-grid-search'

export default function RuntimeImagesPage({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) {
  return <RuntimeImagesPageEntry searchParams={searchParams} />
}
