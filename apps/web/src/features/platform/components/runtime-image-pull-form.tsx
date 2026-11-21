'use client'

import { useState } from 'react'
import { IconDownload } from '@tabler/icons-react'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { RuntimeImagePullNotice, RuntimeImagePullStatus } from './runtime-image-pull-notice'
import { useRuntimeImagePull } from './use-runtime-image-pull'

type Registry = 'docker-hub' | 'custom'

export const RuntimeImagePullForm = ({ loading = false, onPulled }: { loading?: boolean; onPulled?: () => void }) => {
  const [registry, setRegistry] = useState<Registry>('docker-hub')
  const [image, setImage] = useState('')
  const pullFeedback = useSaveFeedback(`${registry}:${image}`)
  const { start, failure, pending, status, stale, clearFailure } = useRuntimeImagePull(() => {
    setImage('')
    pullFeedback.confirmSaved(`${registry}:`)
    onPulled?.()
  })
  const imageError = failure?.fieldErrors?.image?.[0]
  const customRegistry = registry === 'custom'
  const disabled = loading || pending

  const pull = () => {
    if (disabled || !image.trim()) return
    pullFeedback.resetSaveFeedback()
    void start(registry, image)
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
      {failure && !imageError ? <RuntimeImagePullNotice failure={failure} /> : null}
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
              clearFailure()
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
              clearFailure()
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
          pendingLabel={status}
          success={pullFeedback.saved}
          successLabel='Image pulled'
        >
          <IconDownload className='size-4' />
          Pull image
        </MutationButton>
        {loading ? <Skeleton className='absolute inset-0' /> : null}
      </div>
      <RuntimeImagePullStatus
        pending={pending}
        status={status}
        stale={stale}
      />
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
