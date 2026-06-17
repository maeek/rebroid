import { RuntimeImagesPageEntry } from '@/features/platform/pages/runtime-images/page-entry'
import type { ImagesSearchParams } from '@/features/platform/pages/runtime-images/page-data.server'

export default function RuntimeImagesPage({ searchParams }: { searchParams?: Promise<ImagesSearchParams> }) {
  return <RuntimeImagesPageEntry searchParams={searchParams} />
}
