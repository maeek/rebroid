'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { useGappsBuildController } from './hooks/use-gapps-build-controller'
import { GappsBuildConfiguration } from './sections/gapps-build-configuration'
import { GappsBuildProgress } from './sections/gapps-build-progress'
import type { ContainerImageBuildJob, GappsBuildPresetsResponse } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

interface RuntimeGappsImageBuilderPageClientProps {
  presetResponse: GappsBuildPresetsResponse
  jobs: ContainerImageBuildJob[]
  initialSettings: OrchestratorUiSettings
  uploadedApkId?: string
}

export const RuntimeGappsImageBuilderPageClient = (props: RuntimeGappsImageBuilderPageClientProps) => {
  const controller = useGappsBuildController(props)

  return (
    <StandardPage>
      <PageHeader
        section={{ label: 'Runtime' }}
        trail={[{ label: 'Images', href: '/runtime/images' }]}
        title='Build Google Play image'
        description='Patch an official ReDroid image with a locally built, pinned MindTheGapps payload.'
        actions={
          <Button
            asChild
            variant='outline'
          >
            <Link href='/runtime/images/build/custom'>Custom builder</Link>
          </Button>
        }
      />

      <PageContent>
        <div className='grid w-full gap-10 lg:grid-cols-[minmax(20rem,2fr)_minmax(20rem,3fr)] xl:gap-14'>
          <GappsBuildConfiguration
            controller={controller}
            resources={props.presetResponse.resources}
          />
          <GappsBuildProgress controller={controller} />
        </div>
      </PageContent>
    </StandardPage>
  )
}

export const RuntimeGappsImageBuilderPageLoading = () => (
  <StandardPage>
    <PageHeader
      section={{ label: 'Runtime' }}
      trail={[{ label: 'Images', href: '/runtime/images' }]}
      title='Build Google Play image'
      description='Patch an official ReDroid image with a locally built, pinned MindTheGapps payload.'
      actions={
        <Button
          variant='outline'
          disabled
        >
          Custom builder
        </Button>
      }
    />
    <PageContent>
      <div className='grid w-full gap-10 lg:grid-cols-[minmax(20rem,2fr)_minmax(20rem,3fr)] xl:gap-14'>
        <section className='min-w-0'>
          <div className='border-b border-surface-border/60 pb-7'>
            <h2 className='text-base font-medium'>Build configuration</h2>
            <p className='mt-1 text-sm text-foreground-muted'>Choose a version and the local tag for the result.</p>
          </div>
          <div className='grid gap-7 py-8'>
            <div className='grid gap-2'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-10 w-full' />
            </div>
            <div className='grid gap-2'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-9 w-full' />
            </div>
            <Skeleton className='h-20 w-full' />
            <Button
              className='w-full'
              size='lg'
              disabled
            >
              Build image
            </Button>
          </div>
        </section>
        <aside className='min-w-0'>
          <div className='border-b border-surface-border/60 pb-5'>
            <h2 className='text-base font-medium'>Build progress</h2>
            <p className='mt-1 text-sm text-foreground-muted'>Progress and logs will appear here.</p>
          </div>
          <div className='grid gap-3 pt-6'>
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton
                key={index}
                className='h-8 w-full'
              />
            ))}
            <Skeleton className='mt-3 h-72 max-w-full' />
          </div>
        </aside>
      </div>
    </PageContent>
  </StandardPage>
)
