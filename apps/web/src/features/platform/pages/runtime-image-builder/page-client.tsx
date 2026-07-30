'use client'

import { IconHammer } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { DockerfileMonacoEditor } from './dockerfile-monaco-editor'
import { useRuntimeImageBuilderController } from './hooks/use-runtime-image-builder-controller'
import { BuildSection } from './sections/build-section'
import { ContextSection } from './sections/context-section'
import { RecipeSection } from './sections/recipe-section'
import { ValidationSection } from './sections/validation-section'
import type {
  ContainerImageBuildContextFile,
  ContainerImageBuildJob,
  ContainerImageBuildRecipe,
  PlatformImage
} from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

export const RuntimeImageBuilderPageClient = ({
  contextFiles,
  images,
  initialSettings,
  jobs,
  recipes
}: {
  contextFiles: ContainerImageBuildContextFile[]
  images: PlatformImage[]
  initialSettings: OrchestratorUiSettings
  jobs: ContainerImageBuildJob[]
  recipes: ContainerImageBuildRecipe[]
}) => {
  const builder = useRuntimeImageBuilderController({ contextFiles, images, initialSettings, jobs, recipes })

  return (
    <StandardPage>
      <PageHeader
        section={{ label: 'Runtime' }}
        trail={[{ label: 'Images', href: '/runtime/images' }]}
        title='Build image'
        description='Create local Redroid-style runtime images with Rebroid metadata labels.'
        actions={
          <MutationButton
            type='button'
            pending={builder.isStarting}
            pendingLabel='Starting build…'
            disabled={!builder.canStart}
            onClick={() => void builder.startBuild()}
          >
            <IconHammer className='size-4' />
            Build
          </MutationButton>
        }
      />
      <PageContent>
        <section className='grid w-full gap-8 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] xl:gap-10 2xl:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]'>
          <aside className='flex min-w-0 flex-col gap-6'>
            <RecipeSection {...builder.recipeSectionProps} />
            <ContextSection {...builder.contextSectionProps} />
          </aside>

          <main className='flex min-w-0 flex-col gap-6'>
            <Section
              surface='plain'
              title='Dockerfile'
              contentClassName='gap-3'
            >
              <DockerfileMonacoEditor
                value={builder.dockerfile}
                onChange={builder.onDockerfileChange}
              />
            </Section>
            <ValidationSection validation={builder.validation} />
            <BuildSection {...builder.buildSectionProps} />
          </main>
        </section>
      </PageContent>
    </StandardPage>
  )
}

export const RuntimeImageBuilderPageLoading = () => (
  <StandardPage>
    <PageHeader
      section={{ label: 'Runtime' }}
      trail={[{ label: 'Images', href: '/runtime/images' }]}
      title='Build image'
      description='Create local Redroid-style runtime images with Rebroid metadata labels.'
      actions={
        <MutationButton
          type='button'
          disabled
        >
          <IconHammer className='size-4' />
          Build
        </MutationButton>
      }
    />
    <PageContent>
      <section className='grid w-full gap-8 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] xl:gap-10 2xl:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]'>
        <aside className='flex min-w-0 flex-col gap-6'>
          <Section
            surface='plain'
            title='Recipe'
            headingSpacing='default'
          >
            <Skeleton className='h-64 w-full' />
          </Section>
          <Section
            surface='plain'
            title='Context'
            headingSpacing='default'
          >
            <Skeleton className='h-64 w-full' />
          </Section>
        </aside>
        <main className='flex min-w-0 flex-col gap-6'>
          <Section
            surface='plain'
            title='Dockerfile'
            headingSpacing='default'
          >
            <Skeleton className='h-[28rem] max-w-full' />
          </Section>
          <Section
            surface='plain'
            title='Validation'
            headingSpacing='default'
          >
            <Skeleton className='h-24 w-full' />
          </Section>
          <Section
            surface='plain'
            title='Build'
            headingSpacing='default'
          >
            <Skeleton className='h-48 max-w-full' />
          </Section>
        </main>
      </section>
    </PageContent>
  </StandardPage>
)
