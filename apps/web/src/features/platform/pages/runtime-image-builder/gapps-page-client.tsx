'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconCircle, IconExternalLink, IconHammer, IconLoader2, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { cn } from '@/lib/utils'
import {
  cancelImageBuildAction,
  clearGappsCacheAction,
  startGappsBuildAction
} from '@/server/orchestrator/platform/image-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { saveOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { useActiveBuildPolling } from './hooks/use-active-build-polling'
import { terminalBuildStatuses } from './model/context-selection'
import type {
  ContainerImageBuildJob,
  GappsBuildPhase,
  GappsBuildPresetsResponse,
  SupportedGappsAndroidVersion
} from '@/server/orchestrator/platform/types'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

const phaseLabels: Array<{ id: GappsBuildPhase; label: string }> = [
  { id: 'queued', label: 'Queued' },
  { id: 'pulling_base', label: 'Pull ReDroid base' },
  { id: 'resolving_sources', label: 'Resolve source revision' },
  { id: 'building_gapps', label: 'Build MindTheGapps package' },
  { id: 'validating_payload', label: 'Validate Google packages' },
  { id: 'building_image', label: 'Patch image' },
  { id: 'validating_image', label: 'Validate image metadata' },
  { id: 'complete', label: 'Complete' }
]

const bytesToGb = (value: number) => `${(value / 1024 ** 3).toFixed(1)} GB`

export const RuntimeGappsImageBuilderPageClient = ({
  presetResponse,
  jobs,
  initialSettings,
  uploadedApkId
}: {
  presetResponse: GappsBuildPresetsResponse
  jobs: ContainerImageBuildJob[]
  initialSettings: OrchestratorUiSettings
  uploadedApkId?: string
}) => {
  const [androidVersion, setAndroidVersion] = useState<SupportedGappsAndroidVersion>('14')
  const preset = useMemo(
    () => presetResponse.presets.find(item => item.androidVersion === androidVersion) ?? presetResponse.presets[0],
    [androidVersion, presetResponse.presets]
  )
  const [targetImage, setTargetImage] = useState(preset?.defaultTargetImage ?? 'local/redroid-gapps:14')
  const [activeJob, setActiveJob] = useState<ContainerImageBuildJob | null>(
    () => jobs.find(job => job.buildKind === 'redroid_gapps_patch') ?? null
  )
  const [settings, setSettings] = useState(initialSettings)
  const [isStarting, setIsStarting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)
  const isRunning = activeJob ? !terminalBuildStatuses.includes(activeJob.status) : false
  const currentPhase = activeJob?.phase ?? 'queued'
  const currentPhaseIndex = phaseLabels.findIndex(phase => phase.id === currentPhase)

  useActiveBuildPolling(activeJob, setActiveJob)

  useEffect(() => {
    const logElement = logRef.current
    if (logElement) logElement.scrollTop = logElement.scrollHeight
  }, [activeJob?.logTail])

  const selectVersion = (version: SupportedGappsAndroidVersion) => {
    const next = presetResponse.presets.find(item => item.androidVersion === version)
    setAndroidVersion(version)
    if (next) setTargetImage(next.defaultTargetImage)
  }

  const startBuild = async () => {
    setIsStarting(true)
    try {
      const job = unwrapActionResult(await startGappsBuildAction({ androidVersion, targetImage }))
      setActiveJob(job)
      toast({ title: 'Google Play image queued' })
    } catch (error) {
      toast({
        title: 'Could not start build',
        description: getDisplayErrorMessage(error),
        variant: 'destructive'
      })
    } finally {
      setIsStarting(false)
    }
  }

  const cancelBuild = async () => {
    if (!activeJob) return
    try {
      setActiveJob(unwrapActionResult(await cancelImageBuildAction(activeJob.id)))
    } catch (error) {
      toast({ title: 'Could not cancel build', description: getDisplayErrorMessage(error), variant: 'destructive' })
    }
  }

  const setAsDefault = async () => {
    if (!activeJob || activeJob.status !== 'succeeded') return
    try {
      const saved = await saveOrchestratorUiSettings({ ...settings, defaultContainerImage: activeJob.targetImage })
      setSettings(saved)
      toast({ title: 'Default image updated' })
    } catch (error) {
      toast({
        title: 'Could not update default image',
        description: getDisplayErrorMessage(error),
        variant: 'destructive'
      })
    }
  }

  const clearCache = async () => {
    setIsClearing(true)
    try {
      unwrapActionResult(await clearGappsCacheAction(androidVersion))
      toast({ title: `Android ${androidVersion} GApps cache cleared` })
    } catch (error) {
      toast({ title: 'Could not clear cache', description: getDisplayErrorMessage(error), variant: 'destructive' })
    } finally {
      setIsClearing(false)
    }
  }

  const createAppQuery = new URLSearchParams({ image: activeJob?.targetImage ?? targetImage })
  if (uploadedApkId) createAppQuery.set('apk', uploadedApkId)

  return (
    <ProtectedStackPageLayout>
      <PlatformPageHeader
        title='Build Google Play image'
        description='Patch an official ReDroid image with a locally built, pinned MindTheGapps payload.'
        breadcrumbRoot={{ label: 'Runtime', href: '/runtime/images' }}
        parent={{ label: 'Images', href: '/runtime/images' }}
        actions={
          <Button
            asChild
            variant='outline'
          >
            <Link href='/runtime/images/build/custom'>Custom builder</Link>
          </Button>
        }
      />

      <div className='mx-auto w-full max-w-7xl px-6 pb-12 max-sm:px-4'>
        <div className='grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1.15fr)] xl:gap-14'>
          <div className='min-w-0'>
            <div className='border-b border-border/60 pb-7'>
              <h2 className='text-base font-semibold'>Build configuration</h2>
              <p className='mt-1 text-sm text-muted-foreground'>Choose a version and the local tag for the result.</p>
            </div>

            <div className='grid gap-6 py-7'>
              <div className='grid gap-2'>
                <div className='text-sm font-medium'>Android version</div>
                <div className='grid grid-cols-2 gap-2'>
                  {(['14', '13'] as const).map(version => (
                    <Button
                      key={version}
                      type='button'
                      variant={androidVersion === version ? 'default' : 'outline'}
                      disabled={isRunning}
                      onClick={() => selectVersion(version)}
                    >
                      Android {version}
                    </Button>
                  ))}
                </div>
              </div>

              <label className='grid gap-2 text-sm font-medium'>
                Target image
                <Input
                  value={targetImage}
                  disabled={isRunning}
                  onChange={event => setTargetImage(event.target.value)}
                />
              </label>

              {preset ? (
                <dl className='grid gap-4 border-y border-border/60 py-5 text-sm sm:grid-cols-2'>
                  <div className='min-w-0'>
                    <dt className='text-muted-foreground'>ReDroid base</dt>
                    <dd className='mt-1 truncate font-mono text-xs'>{preset.baseImage}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Google apps source</dt>
                    <dd className='mt-1'>
                      <a
                        className='inline-flex items-center gap-1 text-primary hover:underline'
                        href={preset.sourceLink}
                        target='_blank'
                        rel='noreferrer'
                      >
                        MindTheGapps · {preset.sourceBranch} <IconExternalLink className='size-3.5' />
                      </a>
                    </dd>
                  </div>
                </dl>
              ) : null}

              <div
                className={cn(
                  'border-l-2 pl-4 text-sm',
                  presetResponse.resources.canBuild ? 'border-success' : 'border-destructive'
                )}
              >
                <div className='font-medium'>{presetResponse.resources.messages[0]}</div>
                <div className='mt-1 text-muted-foreground'>
                  {bytesToGb(presetResponse.resources.diskAvailableBytes)} free ·{' '}
                  {bytesToGb(presetResponse.resources.memoryAvailableBytes)} memory ·{' '}
                  {presetResponse.resources.cpuCount} CPUs
                </div>
              </div>

              <div>
                <Button
                  size='lg'
                  disabled={!presetResponse.resources.canBuild || isStarting || isRunning || !targetImage.trim()}
                  onClick={() => void startBuild()}
                >
                  {isStarting ? <IconLoader2 className='animate-spin' /> : <IconHammer />}
                  {isRunning ? 'Build in progress' : 'Build image'}
                </Button>
              </div>
            </div>

            <details className='group border-t border-border/60 pt-5 text-sm'>
              <summary className='inline-flex cursor-pointer list-none items-center gap-2 font-medium text-muted-foreground hover:text-foreground'>
                <span className='transition-transform group-open:rotate-90'>›</span>
                Cache options
              </summary>
              <div className='mt-4 flex items-center justify-between gap-4 max-sm:items-start'>
                <span className='text-muted-foreground'>
                  Remove the verified Android {androidVersion} package cache.
                </span>
                <Button
                  variant='outline'
                  disabled={isClearing || isRunning}
                  onClick={() => void clearCache()}
                >
                  {isClearing ? <IconLoader2 className='animate-spin' /> : <IconTrash />}
                  Clear cache
                </Button>
              </div>
            </details>
          </div>

          <aside className='min-w-0 lg:sticky lg:top-24 lg:self-start'>
            <div className='flex items-start justify-between gap-4 border-b border-border/60 pb-5'>
              <div>
                <h2 className='text-base font-semibold'>Build progress</h2>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {activeJob
                    ? (phaseLabels[currentPhaseIndex]?.label ?? activeJob.status)
                    : 'Progress and logs will appear here.'}
                </p>
              </div>
              {isRunning ? (
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => void cancelBuild()}
                >
                  Cancel
                </Button>
              ) : null}
            </div>

            {activeJob ? (
              <div className='grid gap-6 pt-6'>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {phaseLabels.map((phase, index) => {
                    const complete = activeJob.status === 'succeeded' || index < currentPhaseIndex
                    const current = index === currentPhaseIndex && isRunning
                    return (
                      <div
                        key={phase.id}
                        className='flex items-center gap-3 text-sm'
                      >
                        {complete ? (
                          <IconCheck className='size-4 text-success' />
                        ) : current ? (
                          <IconLoader2 className='size-4 animate-spin text-primary' />
                        ) : (
                          <IconCircle className='size-4 text-muted-foreground/50' />
                        )}
                        <span className={cn(current ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                          {phase.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {activeJob.error ? (
                  <div className='border-l-2 border-destructive pl-4 text-sm text-destructive'>{activeJob.error}</div>
                ) : null}

                <div>
                  <div className='mb-2 flex items-center justify-between gap-3'>
                    <h3 className='text-sm font-medium'>Build logs</h3>
                    {isRunning ? <span className='text-xs text-muted-foreground'>Following latest output</span> : null}
                  </div>
                  <pre
                    ref={logRef}
                    data-testid='build-log'
                    className='h-72 overflow-y-auto overscroll-contain rounded-lg bg-black/25 p-4 font-mono text-xs leading-5 text-muted-foreground'
                    aria-live='polite'
                  >
                    {activeJob.logTail || 'Waiting for output…'}
                  </pre>
                </div>

                {activeJob.status === 'succeeded' ? (
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      variant='outline'
                      onClick={() => void setAsDefault()}
                    >
                      Use as default
                    </Button>
                    <Button asChild>
                      <Link href={`/apps/create?${createAppQuery.toString()}`}>Create app</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className='py-12 text-sm text-muted-foreground'>Configure the image, then start the build.</div>
            )}
          </aside>
        </div>
      </div>
    </ProtectedStackPageLayout>
  )
}
