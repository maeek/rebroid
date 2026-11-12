import { FeaturesPage, FeaturesPageLoading } from '@/features/platform/features/features-page'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { InfrastructureServicePage } from './infrastructure-service-page'
import { ServiceSettingsPage } from './service-settings-page'
import { PlatformServicesPage } from './services-page'
import { PlatformServicesPageSkeleton } from './services-page-skeleton'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'
import type { FeatureFlagState, FeatureFlagManifest } from '@/shared/contracts/feature-flags'

const previewFeature = (key: FeatureFlagState['key']): FeatureFlagState => ({
  key,
  owner: 'display',
  description: 'Preview service.',
  control: 'runtime',
  mutable: true,
  enabled: true,
  supported: true,
  effective: true,
  syncStatus: 'applied',
  disablePolicy: 'block_new',
  lifecycle: 'permanent',
  removalCondition: null,
  revision: 1,
  dependencies: [],
  conflicts: []
})

export const servicesPreviewManifest = (all = false): FeatureFlagManifest => ({
  revision: 1,
  features: [
    {
      ...previewFeature('feature.ocr'),
      owner: 'automations',
      description: 'OCR-backed automation perception.',
      enabled: all,
      supported: all,
      effective: all
    },
    {
      ...previewFeature('feature.firewall'),
      owner: 'network-policy',
      description: 'Host firewall policy enforcement.',
      enabled: all,
      effective: all
    },
    {
      ...previewFeature('feature.image-builder'),
      owner: 'container-images',
      description: 'Custom managed container image builds.'
    },
    {
      ...previewFeature('feature.display-virtual'),
      description: 'Experimental virtual display sessions.',
      enabled: false,
      effective: false,
      syncStatus: 'failed' as const
    },
    {
      ...previewFeature('feature.ai'),
      owner: 'automations',
      description: 'AI providers, device-agent tasks, and workflow drafting.',
      enabled: false,
      effective: false
    },
    {
      ...previewFeature('feature.workflows'),
      owner: 'automations',
      description: 'Workflow editing, manual runs, and scheduled triggers.',
      disablePolicy: 'drain_active'
    },
    {
      ...previewFeature('feature.resource-quota'),
      owner: 'android-apps',
      description: 'Per-user open app, CPU, memory, and session limits.'
    },
    {
      ...previewFeature('feature.display-webrtc'),
      description: 'Live viewer streaming over WebRTC.',
      disablePolicy: 'drain_active'
    }
  ]
})

export const FeaturesPreview = ({ loading = false }: { loading?: boolean }) => (
  <FeatureFlagsProvider manifest={servicesPreviewManifest()}>
    {loading ? <FeaturesPageLoading /> : <FeaturesPage initialManifest={servicesPreviewManifest()} />}
  </FeatureFlagsProvider>
)

export const InfrastructureServicePreview = ({
  serviceId,
  unavailable = false
}: {
  serviceId: 'orchestrator' | 'docker'
  unavailable?: boolean
}) => (
  <InfrastructureServicePage
    serviceId={serviceId}
    initialHealth={unavailable ? null : servicesPreviewHealth}
    apiUrl='http://orchestrator:4100'
  />
)

export const ServicesPreview = ({
  all = false,
  loading = false,
  unavailable = false
}: {
  all?: boolean
  loading?: boolean
  unavailable?: boolean
}) => (
  <FeatureFlagsProvider manifest={servicesPreviewManifest(all)}>
    {loading ? (
      <PlatformServicesPageSkeleton />
    ) : (
      <PlatformServicesPage
        initialHealth={unavailable ? null : servicesPreviewHealth}
        initialSettings={defaultOrchestratorUiSettings}
      />
    )}
  </FeatureFlagsProvider>
)

export const OcrServiceSettingsPreview = () => (
  <FeatureFlagsProvider manifest={servicesPreviewManifest(true)}>
    <ServiceSettingsPage
      serviceId='ocr'
      initialHealth={{ ok: true, status: 'healthy', message: 'OCR sidecar is reachable.' }}
      initialSettings={{ ...defaultOrchestratorUiSettings.services.ocr, endpoint: 'http://ocr-sidecar:4300' }}
    />
  </FeatureFlagsProvider>
)

export const servicesPreviewHealth: OrchestratorHealth = {
  ok: false,
  docker: true,
  runtime: true,
  display: true,
  firewall: false,
  ocr: false,
  services: {
    orchestrator: { ok: true, status: 'healthy', message: 'Orchestrator API is responding.' },
    docker: { ok: true, status: 'healthy', message: 'Docker API is reachable.' },
    runtime: { ok: true, status: 'healthy', message: 'Runtime supports privileged app containers.' },
    display: { ok: true, status: 'healthy', message: 'Display sidecar API is responding.' },
    firewall: { ok: false, status: 'offline', message: 'Firewall agent could not be reached.' },
    ocr: { ok: false, status: 'disabled', message: 'OCR is disabled.' }
  }
}
