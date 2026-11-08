'use client'

import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { cn } from '@/lib/utils'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { AppLogsControls } from './app-logs-controls'
import { useApplicationLogs } from './use-application-logs'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppLogsContentProps = {
  app?: AppDefinition
  className?: string
  outputClassName?: string
}

export const AppLogsContent = ({ app, className, outputClassName }: AppLogsContentProps) => {
  const { source, log, isLive, isLoading, sourceUnavailable, changeSource, loadLogs, setIsLive } = useApplicationLogs({
    app,
    loadWhenEnabled: true
  })

  return (
    <AppLogsLayout
      log={log}
      loading={false}
      isLoading={isLoading}
      refreshDisabled={!app}
      onRefresh={() => void loadLogs()}
      className={className}
      outputClassName={outputClassName}
      controls={
        <AppLogsControls
          source={source}
          isLive={isLive}
          sourceUnavailable={sourceUnavailable}
          onSourceChange={changeSource}
          onLiveChange={setIsLive}
        />
      }
    />
  )
}

export const AppLogsLoading = () => (
  <FormLoadingBoundary>
    <AppLogsLayout
      loading
      controls={
        <AppLogsControls
          source='orchestrator'
          isLive={false}
          sourceUnavailable
          onSourceChange={() => undefined}
          onLiveChange={() => undefined}
        />
      }
    />
  </FormLoadingBoundary>
)

const AppLogsLayout = ({
  controls,
  log,
  loading,
  isLoading = false,
  refreshDisabled = false,
  onRefresh = () => undefined,
  className,
  outputClassName
}: AppLogsContentProps & {
  controls: React.ReactNode
  log?: { collectedAt: string; output: string }
  loading: boolean
  isLoading?: boolean
  refreshDisabled?: boolean
  onRefresh?: () => void
}) => {
  return (
    <LogsConsole
      loading={loading}
      log={log}
      isRefreshing={isLoading}
      refreshDisabled={refreshDisabled}
      onRefresh={onRefresh}
      emptyMessage='Refresh logs to inspect container startup failures or Android logcat output.'
      className={className}
      outputClassName={cn('h-[40dvh] min-h-80 max-h-[32rem]', outputClassName)}
      controls={controls}
    />
  )
}
