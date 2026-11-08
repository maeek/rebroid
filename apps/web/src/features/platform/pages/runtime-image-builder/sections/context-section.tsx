import type { ChangeEvent, RefObject } from 'react'
import { IconFiles, IconFolderOpen, IconTrash, IconUpload } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { detectedContextStatusVariant, directoryInputProps } from '../model/context-selection'
import type { LocalBuildContextFile, ResolvedContextReference } from '../model/dockerfile-context-types'
import type { ContainerImageBuildContextFile } from '@/shared/contracts/platform'

type ContextSectionProps = {
  disabled?: boolean
  loading?: boolean
  removingContextFileId?: string | null
  availableContextFiles: ContainerImageBuildContextFile[]
  detectedContextUploadLabel: string
  detectedUploadableCount: number
  fileInputRef: RefObject<HTMLInputElement | null>
  folderInputRef: RefObject<HTMLInputElement | null>
  isConnectingContext: boolean
  isUploading: boolean
  isUploadingDetectedContext: boolean
  localContextFiles: LocalBuildContextFile[]
  localContextLabel: string | null
  resolvedContextReferences: ResolvedContextReference[]
  selectedContextFileIds: Set<string>
  uploadFile: File | null
  uploadPath: string
  uploadProgress: number | null
  onConnectFolder: () => void
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onFolderInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveContextFile: (id: string) => void
  onToggleContextFile: (id: string, checked: boolean) => void
  onUpload: () => void
  onUploadDetectedContext: () => void
  onUploadFileChange: (file: File | null) => void
  onUploadPathChange: (path: string) => void
}

export const ContextSection = ({
  availableContextFiles,
  detectedContextUploadLabel,
  detectedUploadableCount,
  fileInputRef,
  folderInputRef,
  isConnectingContext,
  isUploading,
  isUploadingDetectedContext,
  localContextFiles,
  localContextLabel,
  resolvedContextReferences,
  selectedContextFileIds,
  uploadFile,
  uploadPath,
  uploadProgress,
  onConnectFolder,
  onFileInputChange,
  onFolderInputChange,
  onRemoveContextFile,
  onToggleContextFile,
  onUpload,
  onUploadDetectedContext,
  onUploadFileChange,
  onUploadPathChange,
  disabled = false,
  loading = false,
  removingContextFileId = null
}: ContextSectionProps) => {
  const busy = disabled || loading || isUploading || isUploadingDetectedContext
  const selectedFiles = availableContextFiles.filter(file => selectedContextFileIds.has(file.id))
  return (
    <PlatformResourceSection
      surface='plain'
      title='Build context'
      description='Files available to Dockerfile COPY and ADD instructions.'
      contentClassName='gap-6'
    >
      <input
        ref={folderInputRef}
        type='file'
        multiple
        hidden
        {...directoryInputProps}
        disabled={busy}
        onChange={onFolderInputChange}
      />
      <input
        ref={fileInputRef}
        type='file'
        multiple
        hidden
        disabled={busy}
        onChange={onFileInputChange}
      />
      <div className='flex flex-wrap gap-2'>
        <MutationButton
          type='button'
          variant='secondary'
          pending={isConnectingContext}
          pendingLabel='Opening folder…'
          disabled={busy}
          onClick={onConnectFolder}
        >
          <IconFolderOpen className='size-4' />
          Choose folder
        </MutationButton>
        <Button
          type='button'
          variant='ghost'
          disabled={busy || isConnectingContext}
          onClick={() => fileInputRef.current?.click()}
        >
          <IconFiles className='size-4' />
          Choose files
        </Button>
      </div>
      <p className='min-w-0 break-words text-xs leading-5 text-foreground-muted'>
        {localContextFiles.length} local files{localContextLabel ? ` · ${localContextLabel}` : ''}. Matching files are
        prepared automatically when you build.
      </p>
      {resolvedContextReferences.length > 0 ? (
        <ul
          aria-label='Dockerfile context sources'
          className='grid max-h-72 gap-4 overflow-y-auto'
        >
          {resolvedContextReferences.map(reference => {
            let label: string = reference.status
            if (reference.status === 'selected') label = 'Ready'
            if (reference.status === 'uploadable')
              label = reference.uploadFiles.length > 0 ? 'Uploads on build' : 'Ready to include'
            return (
              <li
                key={reference.reference.id}
                className='grid min-w-0 gap-1'
              >
                {loading ? (
                  <Skeleton className='h-12 w-full' />
                ) : (
                  <>
                    <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                      <span className='min-w-0 break-all font-mono text-xs leading-5'>
                        {reference.contextPath ?? reference.reference.source}
                      </span>
                      <Badge
                        className='shrink-0'
                        variant={detectedContextStatusVariant(reference.status)}
                      >
                        {label}
                      </Badge>
                    </div>
                    <p className='text-xs leading-5 text-foreground-muted [overflow-wrap:anywhere]'>
                      {reference.reference.instruction} line {reference.reference.lineNumber} · {reference.message}
                    </p>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className='text-sm text-foreground-muted'>No local COPY or ADD sources detected.</p>
      )}
      {detectedUploadableCount > 0 ? (
        <MutationButton
          type='button'
          variant='secondary'
          disabled={disabled || loading || isUploading}
          pending={isUploadingDetectedContext}
          pendingLabel='Uploading matching files…'
          onClick={onUploadDetectedContext}
        >
          <IconUpload className='size-4' />
          {detectedContextUploadLabel}
        </MutationButton>
      ) : null}
      {availableContextFiles.length > 0 ? (
        <>
          <FormField
            controlId='builder-uploaded-context'
            label='Uploaded files'
            description='Select files already uploaded to the build context.'
            layout='vertical'
          >
            <MultiSelectCombobox
              disabled={busy}
              options={availableContextFiles.map(file => ({
                value: file.id,
                label: file.contextPath,
                description: file.originalName
              }))}
              value={[...selectedContextFileIds]}
              placeholder='Search uploaded files'
              onValueChange={ids => {
                const next = new Set(ids)
                availableContextFiles.forEach(file => {
                  if (next.has(file.id) !== selectedContextFileIds.has(file.id))
                    onToggleContextFile(file.id, next.has(file.id))
                })
              }}
            />
          </FormField>
          {selectedFiles.length > 0 ? (
            <ul className='grid gap-2'>
              {selectedFiles.map(file => (
                <li
                  key={file.id}
                  className='flex min-w-0 items-center justify-between gap-3'
                >
                  <span className='break-all font-mono text-xs'>{file.contextPath}</span>
                  <MutationButton
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    pending={removingContextFileId === file.id}
                    pendingLabel={<span className='sr-only'>Deleting…</span>}
                    disabled={busy || removingContextFileId !== null}
                    aria-label={`Delete uploaded ${file.contextPath}`}
                    onClick={() => onRemoveContextFile(file.id)}
                  >
                    <IconTrash className='size-4' />
                  </MutationButton>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <Section
        surface='plain'
        title='Upload a single file'
        description='Use a specific path instead of matching a local folder.'
        collapsible
      >
        <div className='grid gap-4'>
          <FormField
            controlId='builder-upload-path'
            label='Path in build context'
            description='Relative path used by COPY or ADD, for example apks/GmsCore.apk.'
            layout='vertical'
          >
            <Input
              disabled={busy}
              value={uploadPath}
              onChange={event => onUploadPathChange(event.target.value)}
            />
          </FormField>
          <FormField
            controlId='builder-upload-file'
            label='File'
            layout='vertical'
          >
            <FileUploadField
              aria-label='Build context file'
              disabled={busy}
              pending={isUploading}
              filenameLabel={uploadFile?.name ?? 'No file selected'}
              onChange={event => {
                onUploadFileChange(event.target.files?.[0] ?? null)
                event.currentTarget.value = ''
              }}
            />
          </FormField>
          <MutationButton
            type='button'
            variant='secondary'
            disabled={disabled || loading || !uploadFile || !uploadPath.trim() || isUploadingDetectedContext}
            pending={isUploading}
            pendingLabel={uploadProgress === null ? 'Uploading…' : `Uploading ${uploadProgress}%`}
            onClick={onUpload}
          >
            <IconUpload className='size-4' />
            Upload file
          </MutationButton>
        </div>
      </Section>
    </PlatformResourceSection>
  )
}
