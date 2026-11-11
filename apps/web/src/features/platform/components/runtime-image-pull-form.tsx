'use client'

import { useState, useTransition } from 'react'
import { IconDownload } from '@tabler/icons-react'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { pullPlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import type { ActionError } from '@/shared/actions/action-result'

type Registry = 'docker-hub' | 'custom'

const unconfirmedPullMessage = 'Refresh the image list before retrying. The pull may still be running.'

export const RuntimeImagePullForm = ({ loading = false, onPulled }: { loading?: boolean; onPulled?: () => void }) => {
  const [registry, setRegistry] = useState<Registry>('docker-hub')
  const [image, setImage] = useState('')
  const [failure, setFailure] = useState<ActionError | null>(null)
  const [pending, startPull] = useTransition()
  const imageError = failure?.fieldErrors?.image?.[0]
  const customRegistry = registry === 'custom'
  const disabled = loading || pending

  const pull = () => {
    if (disabled || !image.trim()) return

    setFailure(null)
    startPull(async () => {
      try {
        const result = await pullPlatformImageAction(registry, image)
        if (!result.ok) {
          setFailure(result.error)
          return
        }

        toast({ title: 'Image pulled', description: result.data.image, variant: 'success' })
        setImage('')
        onPulled?.()
      } catch {
        setFailure({ message: unconfirmedPullMessage, code: 'upstream_unavailable', requestId: '' })
      }
    })
  }

  const form = (
    <form
      aria-label='Pull image'
      className='grid gap-4'
      onSubmit={event => {
        event.preventDefault()
        pull()
      }}
    >
      {failure && !imageError ? (
        <Notice
          title={failure.code === 'upstream_unavailable' ? 'Image pull could not be confirmed' : 'Could not pull image'}
          tone='danger'
          description={failure.code === 'upstream_unavailable' ? unconfirmedPullMessage : failure.message}
        >
          {failure.requestId ? <p>Request ID {failure.requestId}</p> : null}
        </Notice>
      ) : null}
      <div className='grid gap-x-form-column gap-y-4 md:grid-cols-[minmax(13rem,1fr)_minmax(0,3fr)]'>
        <FormField
          label='Registry'
          layout='vertical'
        >
          <Select
            value={registry}
            disabled={disabled}
            onValueChange={value => {
              setRegistry(value)
              setFailure(null)
            }}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='docker-hub'>Docker Hub (anonymous)</SelectItem>
              <SelectItem value='custom'>Other registry (anonymous)</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label='Image'
          layout='vertical'
          error={imageError}
          required
        >
          <Input
            value={image}
            placeholder={customRegistry ? 'ghcr.io/owner/image:tag' : 'redroid/redroid:latest'}
            autoCapitalize='none'
            autoComplete='off'
            spellCheck={false}
            maxLength={512}
            disabled={disabled}
            required
            onChange={event => {
              setImage(event.target.value)
              setFailure(null)
            }}
          />
        </FormField>
      </div>
      <div className='relative justify-self-start'>
        <MutationButton
          className={loading ? 'invisible' : undefined}
          type='submit'
          disabled={loading || !image.trim()}
          pending={pending}
          pendingLabel='Pulling image…'
        >
          <IconDownload className='size-4' />
          Pull image
        </MutationButton>
        {loading ? <Skeleton className='absolute inset-0' /> : null}
      </div>
    </form>
  )

  return (
    <Section
      surface='panel'
      title='Pull image'
      description='Image names without a tag or digest use latest.'
    >
      {loading ? <FormLoadingBoundary>{form}</FormLoadingBoundary> : form}
    </Section>
  )
}
