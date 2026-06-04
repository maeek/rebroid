'use client'

import { LogsConsole } from '@/features/orchestrator/logs/logs-console'
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
    app
  })

  return (
    <LogsConsole
      log={log}
      isRefreshing={isLoading}
      refreshDisabled={!app}
      onRefresh={() => void loadLogs()}
      emptyMessage='Refresh logs to inspect container startup failures or Android logcat output.'
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
