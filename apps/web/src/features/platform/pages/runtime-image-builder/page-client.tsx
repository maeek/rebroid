'use client'

import { IconHammer } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { DockerfileMonacoEditor } from './dockerfile-monaco-editor'
import { useRuntimeImageBuilderController } from './hooks/use-runtime-image-builder-controller'
import { BuildSection } from './sections/build-section'
import { ContextSection } from './sections/context-section'
import { RecipeSection } from './sections/recipe-section'
import { ValidationSection } from './sections/validation-section'
import { ImageBuilderColumns, ImageBuilderLayout } from './ui/image-builder-layout'
import type {
  ContainerImageBuildContextFile,
  ContainerImageBuildJob,
  ContainerImageBuildRecipe,
  PlatformImage
} from '@/shared/contracts/platform'

type BuilderInput = {
  contextFiles: ContainerImageBuildContextFile[]
  images: PlatformImage[]
  jobs: ContainerImageBuildJob[]
  recipes: ContainerImageBuildRecipe[]
}
export const CustomBuilderContent = ({
  builder,
  loading = false
}: {
  builder: ReturnType<typeof useRuntimeImageBuilderController>
  loading?: boolean
}) => {
  const disabled = loading || builder.isStarting || builder.isActiveJobRunning
  return (
    <ImageBuilderLayout
      mode='custom'
      actions={
        <MutationButton
          type='button'
          pending={builder.isStarting || builder.isActiveJobRunning}
          pendingLabel={builder.isActiveJobRunning ? 'Build in progress' : 'Starting build…'}
          disabled={loading || !builder.canStart}
          onClick={() => void builder.startBuild()}
        >
          <IconHammer className='size-4' />
          Build image
        </MutationButton>
      }
    >
      <ImageBuilderColumns
        custom
        configuration={
          <>
            <RecipeSection
              {...builder.recipeSectionProps}
              disabled={disabled}
              loading={loading}
            />
            <ContextSection
              {...builder.contextSectionProps}
              disabled={disabled}
              loading={loading}
            />
          </>
        }
        workspace={
          <>
            <PlatformResourceSection
              surface='plain'
              title='Dockerfile'
              description='Define image layers and reference files from the build context.'
            >
              <DockerfileMonacoEditor
                value={builder.dockerfile}
                onChange={builder.onDockerfileChange}
                disabled={disabled}
                loading={loading}
              />
            </PlatformResourceSection>
            <ValidationSection
              validation={builder.validation}
              loading={loading}
            />
            <BuildSection
              {...builder.buildSectionProps}
              loading={loading}
            />
          </>
        }
      />
    </ImageBuilderLayout>
  )
}

export const RuntimeImageBuilderPageClient = (props: BuilderInput) => {
  const builder = useRuntimeImageBuilderController(props)
  return <CustomBuilderContent builder={builder} />
}
export const RuntimeImageBuilderPageLoading = () => {
  const builder = useRuntimeImageBuilderController({ contextFiles: [], images: [], jobs: [], recipes: [] })
  return (
    <CustomBuilderContent
      builder={builder}
      loading
    />
  )
}
