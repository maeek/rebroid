'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { DisplayViewerFrame } from '@/features/applications/viewer/display/display-viewer-frame'
import { AiAgentToolsSection } from '@/features/applications/viewer/tools/runtime-tools-panel/ai-agent/ai-agent-tools-section'
import { sendBff } from '@/lib/http/bff'
import { draftWorkflowFromAdHocRunAction } from '@/server/orchestrator/automations/automation-management-actions'
import { suggestAdHocAiPromptsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { externalDeviceBffPath } from '@/shared/contracts/external-device'
import { externalDeviceHref } from '@/shared/model/applications/external-device-links'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { ExternalWorkflowRun } from './external-workflow-run'
import { ExternalViewerControls } from './viewer-controls'
import type { RunnableAutomationOption } from '@/shared/contracts/automation'
import type {
  ExternalDeviceLogcat,
  ExternalDeviceScreenshot,
  ExternalViewerSession
} from '@/shared/contracts/external-device'

type ViewerData = {
  name: string
  deviceId: string
  attachmentId: string
  session: ExternalViewerSession
  canControl: boolean
  canClipboard: boolean
  canScreenshot: boolean
  canViewLogs: boolean
  canUseAi: boolean
  canDraftWorkflow: boolean
  contextualSuggestionsEnabled: boolean
  workflows: RunnableAutomationOption[]
}

export function ExternalViewerPage({ data, loading = false }: { data?: ViewerData; loading?: boolean }) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [expired, setExpired] = useState(false)
  const [audio, setAudio] = useState(false)
  const ended = useRef(false)
  const [pending, setPending] = useState<'screenshot' | 'logcat'>()
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<ExternalDeviceLogcat>()
  const [clipboard, setClipboard] = useState('')
  const clipboardRequestedUntil = useRef(0)

  const run = async (action: 'screenshot' | 'logcat') => {
    if (!data || pending || expired) return
    setPending(action)
    setError('')
    try {
      const path = `${externalDeviceBffPath}/${encodeURIComponent(data.deviceId)}`
      const input = { action, attachmentId: data.attachmentId }
      if (action === 'logcat') {
        const result = await sendBff<ExternalDeviceLogcat>(path, input)
        if (!ended.current) setLogs(result)
      } else {
        const screenshot = await sendBff<ExternalDeviceScreenshot>(path, input)
        if (ended.current) return
        const bytes = Uint8Array.from(atob(screenshot.pngBase64), character => character.charCodeAt(0))
        const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
        const download = document.createElement('a')
        download.href = url
        download.download = 'android-screenshot.png'
        download.click()
        setTimeout(() => URL.revokeObjectURL(url), 1_000)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The device tool could not run.')
    } finally {
      setPending(undefined)
    }
  }

  const source = data
    ? `/external-display/viewer/display?${new URLSearchParams({
        sessionId: data.session.id,
        audio: data.session.audioSupported && audio ? '1' : '0'
      })}`
    : undefined
  return (
    <StandardPage>
      <PageHeader
        title={data?.name ?? 'External device viewer'}
        section={{ label: 'Devices', href: '/devices' }}
        actions={
          data?.session.audioSupported && !expired ? (
            <Button
              variant={audio ? 'secondary' : 'outline'}
              aria-pressed={audio}
              onClick={() => {
                clipboardRequestedUntil.current = 0
                setAudio(current => !current)
              }}
            >
              Device audio
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        {error ? <Notice tone='danger'>{error}</Notice> : null}
        {!data && !loading ? (
          <StateView
            kind='unavailable'
            scope='page'
            headingLevel={2}
            title='Viewer unavailable'
            description='Check the device connection and open the viewer again from External devices.'
          />
        ) : (
          <div className='grid gap-4'>
            <div className='h-[65dvh] min-h-56 overflow-hidden rounded-control'>
              {loading ? <Skeleton className='h-full w-full' /> : null}
              {expired ? (
                <Notice>
                  <div className='flex flex-wrap items-center gap-3'>
                    <span>The viewer session ended.</span>
                    <MutationButton
                      variant='outline'
                      pending={refreshing}
                      pendingLabel='Reconnecting…'
                      onClick={() => {
                        if (!data) return
                        const query = new URLSearchParams({
                          attachment: data.attachmentId,
                          retry: crypto.randomUUID()
                        })
                        startRefresh(() => router.replace(`/viewer/devices/external/${data.deviceId}?${query}`))
                      }}
                    >
                      Reconnect viewer
                    </MutationButton>
                    <Button
                      variant='outline'
                      asChild
                    >
                      <Link href={data ? externalDeviceHref(data.deviceId, 'connection') : '/devices'}>
                        Check device connection
                      </Link>
                    </Button>
                  </div>
                </Notice>
              ) : null}
              {source && data && !expired ? (
                <DisplayViewerFrame
                  src={source}
                  keyboardCaptureEnabled={data.canControl}
                  onClipboard={text => {
                    if (data.canClipboard && Date.now() < clipboardRequestedUntil.current) {
                      clipboardRequestedUntil.current = 0
                      setClipboard(text)
                    }
                  }}
                  onStreamStatus={status => {
                    if (status.code === 'session-expired') {
                      ended.current = true
                      clipboardRequestedUntil.current = 0
                      setExpired(true)
                      setLogs(undefined)
                      setClipboard('')
                    }
                  }}
                />
              ) : null}
            </div>
            {data && !expired && (data.canControl || data.canClipboard) ? (
              <ExternalViewerControls
                sessionId={data.session.id}
                canControl={data.canControl}
                canClipboard={data.canClipboard}
                clipboard={clipboard}
                onClipboardChange={setClipboard}
                onReadClipboard={() => {
                  clipboardRequestedUntil.current = Date.now() + 6_000
                }}
              />
            ) : null}
            {data && !expired && (data.canScreenshot || data.canViewLogs) ? (
              <div className='flex flex-wrap gap-2'>
                {data.canScreenshot ? (
                  <MutationButton
                    variant='outline'
                    pending={pending === 'screenshot'}
                    pendingLabel='Capturing…'
                    disabled={Boolean(pending)}
                    onClick={() => void run('screenshot')}
                  >
                    Capture screenshot
                  </MutationButton>
                ) : null}
                {data.canViewLogs ? (
                  <MutationButton
                    variant='outline'
                    pending={pending === 'logcat'}
                    pendingLabel='Reading…'
                    disabled={Boolean(pending)}
                    onClick={() => void run('logcat')}
                  >
                    Read Android logs
                  </MutationButton>
                ) : null}
              </div>
            ) : null}
            {logs ? (
              <Section
                title='Android logs'
                surface='panel'
              >
                <LogsConsole
                  log={logs}
                  emptyMessage='No recent log entries.'
                  outputLabel='Recent Android logs'
                  outputClassName='max-h-80'
                />
              </Section>
            ) : null}
            {data && !expired && data.workflows.length > 0 ? (
              <ExternalWorkflowRun
                key={data.attachmentId}
                deviceId={data.deviceId}
                attachmentId={data.attachmentId}
                workflows={data.workflows}
              />
            ) : null}
            {data && !expired && data.canUseAi ? (
              <Section
                title='AI device agent'
                surface='panel'
              >
                <Notice>Screen images and recognized text may be sent to the selected AI providers.</Notice>
                <AiAgentToolsSection
                  key={data.attachmentId}
                  app={{ id: data.deviceId, name: data.name, running: true, attachmentId: data.attachmentId }}
                  canSaveWorkflow={data.canDraftWorkflow}
                  contextualSuggestionsEnabled={data.contextualSuggestionsEnabled}
                  draftWorkflowFromRun={draftWorkflowFromAdHocRunAction}
                  generatePromptSuggestions={suggestAdHocAiPromptsAction}
                />
              </Section>
            ) : null}
          </div>
        )}
      </PageContent>
    </StandardPage>
  )
}

export const ExternalViewerLoading = () => <ExternalViewerPage loading />
