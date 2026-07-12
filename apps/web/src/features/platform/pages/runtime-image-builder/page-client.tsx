'use client'

import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { IconHammer, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { sendBff } from '@/lib/http/bff'
import {
  createImageBuildRecipeAction,
  removeImageBuildContextFileAction,
  startImageBuildAction
} from '@/server/orchestrator/platform/image-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { saveOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import {
  parseDockerfileContextReferences,
  resolveDockerfileContextReferences,
  uploadResolvedContextReferences,
  type LocalBuildContextFile
} from './dockerfile-context'
import { DockerfileMonacoEditor } from './dockerfile-monaco-editor'
import { useActiveBuildPolling } from './hooks/use-active-build-polling'
import {
  localBuildContextFilesFromFileList,
  readDirectoryWithPicker,
  supportsDirectoryPicker,
  type LocalBuildContextSelection
} from './local-build-context-files'
import { buildValidation } from './model/build-validation'
import {
  contextIdsFromRecipe,
  defaultBuilderValues,
  recipeToValues,
  templateDockerfile,
  type BuilderValues
} from './model/builder-values'
import { maxSelectedContextFiles, mergeContextFiles, terminalBuildStatuses } from './model/context-selection'
import { BuildSection } from './sections/build-section'
import { ContextSection } from './sections/context-section'
import { RecipeSection } from './sections/recipe-section'
import { ValidationSection } from './sections/validation-section'
import { uploadRuntimeImageContextFile } from './upload-runtime-image-context-file'
import type {
  ContainerImageBuildContextFile,
  ContainerImageBuildJob,
  ContainerImageBuildRecipe,
  PlatformImage
} from '@/server/orchestrator/platform/types'
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
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [values, setValues] = useState<BuilderValues>(defaultBuilderValues)
  const [savedRecipes, setSavedRecipes] = useState(recipes)
  const [availableContextFiles, setAvailableContextFiles] = useState(contextFiles)
  const [selectedContextFileIds, setSelectedContextFileIds] = useState<Set<string>>(() => new Set())
  const [localContextFiles, setLocalContextFiles] = useState<LocalBuildContextFile[]>([])
  const [localContextLabel, setLocalContextLabel] = useState<string | null>(null)
  const [uploadPath, setUploadPath] = useState('apks/GmsCore.apk')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isConnectingContext, setIsConnectingContext] = useState(false)
  const [isUploadingDetectedContext, setIsUploadingDetectedContext] = useState(false)
  const [detectedContextUploadProgress, setDetectedContextUploadProgress] = useState<{
    completed: number
    total: number
  } | null>(null)
  const [isSavingRecipe, setIsSavingRecipe] = useState(false)
  const [activeJob, setActiveJob] = useState<ContainerImageBuildJob | null>(() => jobs[0] ?? null)
  const [isStarting, setIsStarting] = useState(false)
  const [runtimeSettings, setRuntimeSettings] = useState(initialSettings)
  const dockerfileContextReferences = useMemo(
    () => parseDockerfileContextReferences(values.dockerfile),
    [values.dockerfile]
  )
  const resolvedContextReferences = useMemo(
    () =>
      resolveDockerfileContextReferences({
        contextFiles: availableContextFiles,
        localFiles: localContextFiles,
        references: dockerfileContextReferences,
        selectedContextFileIds
      }),
    [availableContextFiles, dockerfileContextReferences, localContextFiles, selectedContextFileIds]
  )
  const selectedContextFiles = useMemo(
    () => availableContextFiles.filter(file => selectedContextFileIds.has(file.id)),
    [availableContextFiles, selectedContextFileIds]
  )
  const validation = useMemo(
    () => buildValidation(values, selectedContextFiles, resolvedContextReferences),
    [resolvedContextReferences, selectedContextFiles, values]
  )
  const detectedUploadableCount = useMemo(
    () => resolvedContextReferences.filter(reference => reference.status === 'uploadable').length,
    [resolvedContextReferences]
  )
  const detectedContextUploadLabel = detectedContextUploadProgress
    ? `Upload ${detectedContextUploadProgress.completed}/${detectedContextUploadProgress.total}`
    : 'Upload missing'
  const canStart = validation.errors.length === 0 && !isStarting && !isUploadingDetectedContext
  const isActiveJobRunning = activeJob ? !terminalBuildStatuses.includes(activeJob.status) : false

  useActiveBuildPolling(activeJob, setActiveJob)

  const patchValues = (patch: Partial<BuilderValues>) => setValues(current => ({ ...current, ...patch }))

  const applyTemplate = (androidVersion: string) => {
    const baseImage = `redroid/redroid:${androidVersion}.0.0-latest`
    setValues(current => ({
      ...current,
      name: `Redroid ${androidVersion} microG overlay`,
      targetImage: `local/redroid-microg:${androidVersion}`,
      baseImage,
      androidVersion,
      runtimeKind: 'redroid',
      gmsMode: 'microg',
      signatureSpoofing: 'external_required',
      dockerfile: templateDockerfile(baseImage)
    }))
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setIsUploading(true)
    setUploadProgress(0)
    try {
      const uploaded = await uploadRuntimeImageContextFile({
        contextPath: uploadPath,
        file: uploadFile,
        onProgress: setUploadProgress
      })
      setAvailableContextFiles(current => [uploaded, ...current])
      setSelectedContextFileIds(current => new Set(current).add(uploaded.id))
      setUploadFile(null)
      setUploadProgress(null)
      toast({ title: 'Context file uploaded' })
    } catch (error) {
      toast({
        title: 'Could not upload context file',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsUploading(false)
    }
  }

  const applyLocalContextSelection = (selection: LocalBuildContextSelection) => {
    setLocalContextFiles(selection.files)
    setLocalContextLabel(selection.label)
    toast({
      title: 'Local context connected',
      description: `${selection.files.length} files available from ${selection.label}.`
    })
  }

  const connectFolder = async () => {
    if (!supportsDirectoryPicker()) {
      folderInputRef.current?.click()
      return
    }

    setIsConnectingContext(true)
    try {
      applyLocalContextSelection(await readDirectoryWithPicker())
    } catch (error) {
      const name = error instanceof DOMException ? error.name : null
      if (name !== 'AbortError') {
        toast({
          title: 'Could not connect folder',
          description: getDisplayErrorMessage(error),
          variant: 'danger'
        })
      }
    } finally {
      setIsConnectingContext(false)
    }
  }

  const handleLocalFileInput = (event: ChangeEvent<HTMLInputElement>, useRelativePath: boolean) => {
    const files = event.currentTarget.files
    if (!files || files.length === 0) {
      return
    }

    applyLocalContextSelection(
      localBuildContextFilesFromFileList(files, {
        fallbackRootLabel: useRelativePath ? 'Selected folder' : 'Selected files',
        useRelativePath
      })
    )
    event.currentTarget.value = ''
  }

  const uploadDetectedContext = async () => {
    setIsUploadingDetectedContext(true)
    setDetectedContextUploadProgress({ completed: 0, total: 0 })
    try {
      const result = await uploadResolvedContextReferences({
        contextFileLimit: maxSelectedContextFiles,
        onProgress: setDetectedContextUploadProgress,
        resolvedReferences: resolvedContextReferences,
        selectedContextFileIds,
        upload: file =>
          uploadRuntimeImageContextFile({
            contextPath: file.contextPath,
            file: file.file
          })
      })
      setAvailableContextFiles(current => mergeContextFiles(current, result.uploadedFiles))
      setSelectedContextFileIds(result.selectedIds)
      return result.selectedIds
    } finally {
      setIsUploadingDetectedContext(false)
      setDetectedContextUploadProgress(null)
    }
  }

  const handleUploadDetectedContext = async () => {
    try {
      const nextSelectedIds = await uploadDetectedContext()
      toast({
        title: 'Context files ready',
        description: `${nextSelectedIds.size} context files selected.`
      })
    } catch (error) {
      toast({
        title: 'Could not upload detected context',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const removeContextFile = async (id: string) => {
    try {
      unwrapActionResult(await removeImageBuildContextFileAction(id))
      setAvailableContextFiles(current => current.filter(file => file.id !== id))
      setSelectedContextFileIds(current => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    } catch (error) {
      toast({
        title: 'Could not remove context file',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const saveRecipe = async () => {
    setIsSavingRecipe(true)
    try {
      const recipe = unwrapActionResult(
        await createImageBuildRecipeAction({
          ...values,
          androidVersion: values.androidVersion || null,
          architecture: values.architecture || null,
          contextFileIds: [...selectedContextFileIds]
        })
      )
      setSavedRecipes(current => [recipe, ...current])
      toast({ title: 'Recipe saved' })
    } catch (error) {
      toast({
        title: 'Could not save recipe',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSavingRecipe(false)
    }
  }

  const startBuild = async () => {
    if (!canStart) return
    setIsStarting(true)
    try {
      const resolvedContextFileIds =
        detectedUploadableCount > 0 ? await uploadDetectedContext() : selectedContextFileIds
      const job = unwrapActionResult(
        await startImageBuildAction({
          ...values,
          androidVersion: values.androidVersion || null,
          architecture: values.architecture || null,
          contextFileIds: [...resolvedContextFileIds]
        })
      )
      setActiveJob(job)
      toast({ title: 'Build started' })
    } catch (error) {
      toast({
        title: 'Could not start build',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsStarting(false)
    }
  }

  const cancelBuild = async () => {
    if (!activeJob) return
    try {
      setActiveJob(
        await sendBff<ContainerImageBuildJob>(
          `/api/bff/platform/image-builds/${encodeURIComponent(activeJob.id)}/cancel`,
          {}
        )
      )
      toast({ title: 'Build cancelled' })
    } catch (error) {
      toast({
        title: 'Could not cancel build',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const setAsDefault = async () => {
    if (!activeJob || activeJob.status !== 'succeeded') return
    try {
      const saved = await saveOrchestratorUiSettings({
        ...runtimeSettings,
        defaultContainerImage: activeJob.targetImage
      })
      setRuntimeSettings(saved)
      toast({ title: 'Default image updated' })
    } catch (error) {
      toast({
        title: 'Could not update default image',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const selectRecipe = (id: string) => {
    const recipe = savedRecipes.find(item => item.id === id)
    if (!recipe) return
    setValues(recipeToValues(recipe))
    setSelectedContextFileIds(new Set(contextIdsFromRecipe(recipe)))
  }

  const toggleContextFile = (id: string, checked: boolean) => {
    setSelectedContextFileIds(current => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

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
            disabled={!canStart}
            onClick={() => void startBuild()}
          >
            {isStarting ? <IconLoader2 className='size-4 animate-spin' /> : <IconHammer className='size-4' />}
            Build
          </Button>
        }
      />
      <PageContent className='mx-auto max-w-7xl'>
        <section className='grid w-full gap-8 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,48rem)] lg:justify-center xl:gap-10'>
          <aside className='flex min-w-0 flex-col gap-6'>
            <RecipeSection
              images={images}
              isSavingRecipe={isSavingRecipe}
              recipes={savedRecipes}
              values={values}
              onApplyTemplate={applyTemplate}
              onPatchValues={patchValues}
              onSaveRecipe={() => void saveRecipe()}
              onSelectRecipe={selectRecipe}
            />

            <ContextSection
              availableContextFiles={availableContextFiles}
              detectedContextUploadLabel={detectedContextUploadLabel}
              detectedUploadableCount={detectedUploadableCount}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              isConnectingContext={isConnectingContext}
              isUploading={isUploading}
              isUploadingDetectedContext={isUploadingDetectedContext}
              localContextFiles={localContextFiles}
              localContextLabel={localContextLabel}
              resolvedContextReferences={resolvedContextReferences}
              selectedContextFileIds={selectedContextFileIds}
              uploadFile={uploadFile}
              uploadPath={uploadPath}
              uploadProgress={uploadProgress}
              onConnectFolder={() => void connectFolder()}
              onFileInputChange={event => handleLocalFileInput(event, false)}
              onFolderInputChange={event => handleLocalFileInput(event, true)}
              onRemoveContextFile={id => void removeContextFile(id)}
              onToggleContextFile={toggleContextFile}
              onUpload={() => void handleUpload()}
              onUploadDetectedContext={() => void handleUploadDetectedContext()}
              onUploadFileChange={setUploadFile}
              onUploadPathChange={setUploadPath}
            />
          </aside>

          <main className='flex min-w-0 flex-col gap-6'>
            <Section
              surface='plain'
              title='Dockerfile'
              contentClassName='gap-3'
            >
              <DockerfileMonacoEditor
                value={values.dockerfile}
                onChange={dockerfile => patchValues({ dockerfile })}
              />
            </Section>

            <ValidationSection validation={validation} />
            <BuildSection
              activeJob={activeJob}
              canStart={canStart}
              isActiveJobRunning={isActiveJobRunning}
              isStarting={isStarting}
              onCancelBuild={() => void cancelBuild()}
              onSetAsDefault={() => void setAsDefault()}
              onStartBuild={() => void startBuild()}
            />
          </main>
        </section>
      </PageContent>
    </StandardPage>
  )
}
