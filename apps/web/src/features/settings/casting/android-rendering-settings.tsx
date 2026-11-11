'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { getBff, sendBff } from '@/lib/http/bff'
import { ActionResultError } from '@/shared/actions/action-result'
import { androidRenderingSettingsSchema } from '@/shared/contracts/android-rendering-settings'
import { DetailFields } from '@/shared/ui/detail-fields'
import { AndroidRenderingSettingsDialog } from './android-rendering-settings-dialog'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { AndroidRenderingSettings as RenderingSettings } from '@rebroid/android-application-core/redroid-runtime'

const endpoint = '/api/bff/platform/android-rendering'
const queryKey = ['android-rendering-settings'] as const

const feedbackMessage = (error: unknown, fallback: string) =>
  error instanceof ActionResultError ? `${error.message} Request ID ${error.failure.requestId}.` : fallback

export const AndroidRenderingSettings = ({
  applications,
  loading = false,
  refreshKey = 0
}: {
  applications: Pick<AndroidApplication, 'runtime'>[]
  loading?: boolean
  refreshKey?: number
}) => {
  const client = useQueryClient()
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: ({ signal }) => getBff<RenderingSettings>(endpoint, signal),
    enabled: !loading
  })
  useEffect(() => {
    if (refreshKey > 0) void refetch()
  }, [refreshKey, refetch])

  const [draft, setDraft] = useState<RenderingSettings>()
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const parsed = androidRenderingSettingsSchema.safeParse(draft)
  const changed = draft?.mode !== data?.mode || draft?.renderDevice !== data?.renderDevice
  const edit = (open: boolean) => {
    if (pending) return
    setDraft(open ? data : undefined)
    setSaveError(undefined)
    if (open) setSaved(false)
  }
  const save = async () => {
    if (pending || error || !changed || !parsed.success) return
    setPending(true)
    setSaveError(undefined)
    try {
      const result = await sendBff<RenderingSettings>(endpoint, parsed.data, 'PATCH')
      await client.cancelQueries({ queryKey })
      client.setQueryData(queryKey, result)
      setDraft(undefined)
      setSaved(true)
    } catch (cause) {
      setSaveError(feedbackMessage(cause, 'Could not save Android rendering settings. Try again.'))
    } finally {
      setPending(false)
    }
  }

  const runtimes = applications
    .map(app => app.runtime)
    .filter(runtime => runtime.kind === 'redroid' && runtime.containerId)
  const unknown = runtimes.filter(runtime => !runtime.appliedRendering).length
  const different = runtimes.filter(
    ({ appliedRendering }) =>
      appliedRendering &&
      (appliedRendering.mode !== data?.mode ||
        (data?.mode === 'host' && appliedRendering.renderDevice !== data.renderDevice))
  ).length

  return (
    <Dialog
      open={Boolean(draft)}
      onOpenChange={edit}
    >
      <Section
        surface='panel'
        title='Android GPU rendering'
        description='Set the renderer for managed Redroid applications across the platform.'
        actions={
          <DialogTrigger asChild>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              disabled={loading || !data || Boolean(error)}
            >
              Edit rendering
            </Button>
          </DialogTrigger>
        }
      >
        <div className='grid gap-4'>
          {error ? (
            <Notice
              tone='danger'
              title='Android rendering settings unavailable'
              description={feedbackMessage(error, 'Try loading the settings again.')}
              actions={
                <MutationButton
                  type='button'
                  variant='ghost'
                  pending={isFetching}
                  onClick={() => void refetch()}
                >
                  Try again
                </MutationButton>
              }
            />
          ) : null}
          {loading || isLoading || data ? (
            <DetailFields
              loading={loading || isLoading}
              fields={[
                { label: 'Rendering mode', value: data?.mode === 'host' ? 'Host GPU' : 'Software (default)' },
                { label: 'GPU render device', value: data?.mode === 'host' ? data.renderDevice : 'Unused', code: true }
              ]}
            />
          ) : null}
          {data && !loading ? (
            <>
              <p className='text-sm text-foreground-muted'>
                Stop and start existing Redroid applications to apply changes. Persistent profiles are retained.
                Temporary data can be lost when a container is replaced. To roll back, save Software and stop and start
                the affected applications.
              </p>
              {runtimes.length > 0 ? (
                <p className='text-sm text-foreground-muted'>
                  Of the existing Redroid runtimes, {different} differ from the saved setting and {unknown} have no
                  recorded configuration.
                </p>
              ) : null}
              {data.mode === 'host' ? (
                <p className='text-sm text-foreground-muted'>Hardware rendering is unverified.</p>
              ) : null}
              {saved ? (
                <Notice
                  tone='success'
                  title='Rendering settings saved'
                />
              ) : null}
              <a
                className='w-fit text-sm text-primary underline'
                href='https://github.com/maeek/rebroid/blob/main/docs/deployment.md#android-gpu-rendering-on-linux'
              >
                GPU rendering setup
              </a>
            </>
          ) : null}
        </div>
      </Section>
      {draft ? (
        <AndroidRenderingSettingsDialog
          draft={draft}
          pending={pending}
          unavailable={Boolean(error)}
          valid={parsed.success}
          changed={changed}
          error={saveError}
          onChange={next => {
            setDraft(
              next.mode === 'software' && !androidRenderingSettingsSchema.safeParse(next).success
                ? { ...next, renderDevice: data?.renderDevice ?? null }
                : next
            )
            setSaveError(undefined)
          }}
          onSave={() => void save()}
          onCancel={() => edit(false)}
        />
      ) : null}
    </Dialog>
  )
}
