import { TooltipProvider } from '@/components/ui/tooltip'
import { DisplayViewerPage } from '@/features/applications/viewer/display/display-viewer-page'
import type { ViewerSearchParams } from '@/features/applications/viewer/display/display-viewer-page-utils'

export const DisplayViewerPageEntry = ({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<ViewerSearchParams>
}) => (
  <TooltipProvider>
    <DisplayViewerPage
      params={params}
      searchParams={searchParams}
    />
  </TooltipProvider>
)
