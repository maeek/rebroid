import { TooltipProvider } from '@/components/ui/tooltip'
import { DisplayViewerPage } from '@/features/applications/viewer/display/display-viewer-page'
import type { ViewerSearchParams } from '@/features/applications/viewer/display/display-viewer-page'

export default function ViewerAppPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<ViewerSearchParams>
}) {
  return (
    <TooltipProvider>
      <DisplayViewerPage
        params={params}
        searchParams={searchParams}
      />
    </TooltipProvider>
  )
}
