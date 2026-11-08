'use client'

import { Suspense } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { AiProvidersPageLayout } from './ai-providers-page-layout'
import { ProviderConnectionSection } from './provider-edit-form-sections'
import { ProviderEditorLayout, type ProviderEditorView } from './provider-editor-layout'
import { emptyProvider } from './provider-form-model'
import { ProviderHealthBannerContent } from './provider-health-badge'
import { ProviderModelDefaults } from './provider-model-defaults'
import { ProviderModelsGrid } from './provider-models-grid'
import { ProvidersGrid } from './providers-grid'

const noop = () => undefined

export const AiProvidersPageSkeleton = () => (
  <AiProvidersPageLayout
    actions={<Skeleton className='h-9 w-32' />}
    providers={
      <ProvidersGrid
        providers={[]}
        loading
        busyId={null}
        selectedIds={new Set()}
        onSelectedIdsChange={noop}
        onEnableSelected={noop}
        onDisableSelected={noop}
        onDeleteSelected={noop}
        onEdit={noop}
        onDelete={noop}
      />
    }
    suggestions={
      <div
        data-testid='ai-context-suggestions-skeleton'
        className='grid gap-3'
      >
        <Skeleton className='h-4 w-36' />
        <Skeleton className='h-4 w-72 max-w-full' />
        <Skeleton className='h-5 w-9' />
      </div>
    }
  />
)

export const AiProviderEditPageSkeleton = () => (
  <Suspense fallback={<ProviderEditorSkeleton view='models' />}>
    <ProviderRouteSkeleton />
  </Suspense>
)

const ProviderRouteSkeleton = () => (
  <ProviderEditorSkeleton view={useSearchParams().get('view') === 'connection' ? 'connection' : 'models'} />
)

export const ProviderEditorSkeleton = ({ view }: { view: ProviderEditorView }) => (
  <ProviderEditorLayout
    provider={{ ...emptyProvider(), label: 'AI provider' }}
    view={view}
    loading
    actions={
      <>
        <Button
          variant='ghost'
          disabled
        >
          Discard changes
        </Button>
        <Button disabled>
          <IconDeviceFloppy className='size-4' />
          Save
        </Button>
      </>
    }
    health={<ProviderHealthBannerContent loading />}
  >
    {view === 'connection' ? (
      <FormLoadingBoundary>
        <ProviderConnectionSection
          provider={emptyProvider()}
          disabled
          onChange={noop}
        />
      </FormLoadingBoundary>
    ) : (
      <>
        <ProviderModelDefaults
          models={[]}
          disabled
          loading
          onChange={noop}
        />
        <ProviderModelsGrid
          initialProvider={emptyProvider()}
          modelRows={[]}
          loading
          disabled
          onAddModel={() => false}
          onBulkRemoveModels={noop}
          onBulkUpdateModels={noop}
          onDownloadModel={() => Promise.resolve()}
          onRemoveModel={noop}
          onUpdateModel={noop}
          isDownloadingModel={false}
          isLoadingRemoteModels={false}
          modelDownloads={{}}
          remoteModels={[]}
          remoteModelsError={null}
          onLoadRemoteModels={noop}
        />
      </>
    )}
  </ProviderEditorLayout>
)
