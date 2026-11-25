'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { AiAgentToolsSection } from '@/features/applications/viewer/tools/runtime-tools-panel/ai-agent/ai-agent-tools-section'
import { sendBff } from '@/lib/http/bff'
import { draftWorkflowFromAdHocRunAction } from '@/server/orchestrator/automations/automation-management-actions'
import { suggestAdHocAiPromptsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { rememberRecentAppAction } from '@/server/recent-apps/actions'
import { externalDeviceBffPath } from '@/shared/contracts/external-device'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { ExternalDeviceConnection } from './device-connection'
import type { ExternalDevice, ExternalDeviceLogcat } from '@/shared/contracts/external-device'

export function RememberExternalDevice({ id }: { id: string }) {
  useEffect(() => {
    void rememberRecentAppAction(id)
      .then(notifyRecentAppsUpdated)
      .catch(() => undefined)
  }, [id])
  return null
}

export function ExternalDetailConnection({
  initial,
  enabled,
  canEnroll,
  canUse
}: {
  initial: ExternalDevice
  enabled: boolean
  canEnroll: boolean
  canUse: boolean
}) {
  const router = useRouter()
  const [device, setDevice] = useState(initial)
  return (
    <ExternalDeviceConnection
      device={device}
      enabled={enabled}
      canEnroll={canEnroll}
      canConnect={canUse}
      ownedByCurrentUser={canUse}
      onChange={setDevice}
      onForget={() => router.replace('/devices')}
    />
  )
}

export function ExternalDeviceDiagnostics({ device, attachmentId }: { device: ExternalDevice; attachmentId: string }) {
  const [pending, setPending] = useState(false)
  const [log, setLog] = useState<ExternalDeviceLogcat>()
  const [error, setError] = useState('')
  const read = async () => {
    setPending(true)
    setError('')
    setLog(undefined)
    try {
      setLog(
        await sendBff<ExternalDeviceLogcat>(`${externalDeviceBffPath}/${device.id}`, { action: 'logcat', attachmentId })
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read Android logs.')
    } finally {
      setPending(false)
    }
  }
  return (
    <Section
      title='Android logs'
      surface='panel'
    >
      <MutationButton
        className='w-fit'
        variant='outline'
        pending={pending}
        pendingLabel='Reading…'
        onClick={() => void read()}
      >
        Read Android logs
      </MutationButton>
      {error ? <Notice tone='danger'>{error}</Notice> : null}
      {log ? (
        <LogsConsole
          log={log}
          emptyMessage='No recent log entries.'
          outputLabel='Recent Android logs'
          outputClassName='max-h-80'
        />
      ) : null}
    </Section>
  )
}

export function ExternalDeviceAgent({
  device,
  attachmentId,
  canSaveWorkflow,
  contextualSuggestionsEnabled
}: {
  device: ExternalDevice
  attachmentId: string
  canSaveWorkflow: boolean
  contextualSuggestionsEnabled: boolean
}) {
  return (
    <Section
      title='AI device agent'
      surface='panel'
    >
      <Notice>Screen images and recognized text may be sent to the selected AI providers.</Notice>
      <AiAgentToolsSection
        app={{ id: device.id, name: device.name, running: true, attachmentId }}
        canSaveWorkflow={canSaveWorkflow}
        contextualSuggestionsEnabled={contextualSuggestionsEnabled}
        draftWorkflowFromRun={draftWorkflowFromAdHocRunAction}
        generatePromptSuggestions={suggestAdHocAiPromptsAction}
      />
    </Section>
  )
}
