import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { PlatformRuntimeFieldsSection } from './platform-runtime-fields-section'
import { PlatformRuntimeMaintenanceSection } from './platform-runtime-maintenance-section'
import { PlatformRuntimePageLayout } from './platform-runtime-page-layout'

export const PlatformRuntimePageSkeleton = () => (
  <PlatformRuntimePageLayout>
    <form
      id='runtime-defaults-form'
      aria-label='Runtime defaults'
    >
      <PlatformRuntimeFieldsSection
        images={[]}
        settings={defaultOrchestratorUiSettings}
        onSettingsChange={() => {}}
        loading
      />
    </form>
    <PlatformRuntimeMaintenanceSection loading />
  </PlatformRuntimePageLayout>
)
