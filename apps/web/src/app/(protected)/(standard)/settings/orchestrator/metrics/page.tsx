import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { DockerMetricsDashboard } from '@/features/orchestrator/metrics/docker-metrics-dashboard'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'

export default function OrchestratorMetricsPage() {
  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Metrics'
        description='Live Docker API workload, latency, retries, and recent transport failures reported by the orchestrator.'
      />
      <DockerMetricsDashboard />
    </ProtectedStackPageLayout>
  )
}
