'use client'

import { IconHammer, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
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
          <Button
            type='button'
            disabled={!builder.canStart}
            onClick={() => void builder.startBuild()}
          >
            {builder.isStarting ? <IconLoader2 className='size-4 animate-spin' /> : <IconHammer className='size-4' />}
            Build
          </Button>
        }
      />
      <PageContent className='mx-auto max-w-7xl'>
        <section className='grid w-full gap-8 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,48rem)] lg:justify-center xl:gap-10'>
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
