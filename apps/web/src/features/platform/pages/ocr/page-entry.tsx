import { Suspense } from 'react'
import { ServiceSettingsPage } from '@/features/platform/services/service-settings-page'
import { requireAdmin } from '@/server/auth/authorization'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { loadOcrPageData } from './page-data.server'
import { OcrPageLoading } from './page-loading'

const OcrPageContent = async () => {
  await requireAdmin()

  return (
    <OrchestratorPageBoundary
      load={loadOcrPageData}
      fallback={requestId => (
        <ServiceSettingsPage
          serviceId='ocr'
          requestId={requestId}
        />
      )}
    >
      {data => (
        <ServiceSettingsPage
          serviceId='ocr'
          {...data}
        />
      )}
    </OrchestratorPageBoundary>
  )
}

export const OcrPageEntry = () => (
  <Suspense fallback={<OcrPageLoading />}>
    <OcrPageContent />
  </Suspense>
)
