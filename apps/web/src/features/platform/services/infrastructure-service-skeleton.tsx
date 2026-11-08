'use client'

import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { DockerMetricsContent } from '@/features/platform/metrics/docker-metrics-dashboard'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { DockerOperationLimitsForm } from './docker-operation-limits-form'
import { InfrastructureServiceLayout } from './infrastructure-service-layout'

export const InfrastructureServiceSkeleton = ({ serviceId }: { serviceId: 'orchestrator' | 'docker' }) => (
  <InfrastructureServiceLayout
    serviceId={serviceId}
    loading
    actions={
      <PlatformPageRefreshButton
        disabled
        onRefresh={() => undefined}
      />
    }
    health={
      <Notice
        live='off'
        title={<Skeleton className='h-5 w-20' />}
        description={<Skeleton className='h-5 w-full max-w-96' />}
      />
    }
    limits={
      serviceId === 'docker' ? (
        <DockerOperationLimitsForm
          loading
          onSaved={() => undefined}
        />
      ) : undefined
    }
    diagnostics={
      serviceId === 'docker' ? (
        <DockerMetricsContent
          data={null}
          history={[]}
          loading
        />
      ) : undefined
    }
  />
)
