import type { ChangeEvent, RefObject } from 'react'
import { IconFiles, IconFolderOpen, IconLoader2, IconTrash, IconUpload } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { FormField } from '@/components/ui/form-field'
import { detectedContextStatusVariant, directoryInputProps } from '../model/context-selection'
import type { LocalBuildContextFile, ResolvedContextReference } from '../dockerfile-context'
import type { ContainerImageBuildContextFile } from '@/server/orchestrator/platform/types'

const verticalSettingClassName = 'flex-col items-start w-full'

type ContextSectionProps = {
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
  onUploadPathChange
}: ContextSectionProps) => (
  <Section
    surface='plain'
    title='Context'
    contentClassName='gap-4'
  >
    <input
      ref={folderInputRef}
      type='file'
      multiple
      className='hidden'
      {...directoryInputProps}
      onChange={onFolderInputChange}
    />
    <input
      ref={fileInputRef}
      type='file'
      multiple
      className='hidden'
      onChange={onFileInputChange}
    />
    <div className='flex flex-wrap gap-2'>
      <Button
        type='button'
        variant='secondary'
        disabled={isConnectingContext}
        onClick={onConnectFolder}
      >
        {isConnectingContext ? <IconLoader2 className='size-4 animate-spin' /> : <IconFolderOpen />}
        Connect folder
      </Button>
      <Button
        type='button'
        variant='secondary'
        onClick={() => folderInputRef.current?.click()}
      >
        <IconFolderOpen className='size-4' />
        Select folder
      </Button>
      <Button
        type='button'
        variant='secondary'
        onClick={() => fileInputRef.current?.click()}
      >
        <IconFiles className='size-4' />
        Select files
      </Button>
    </div>
    <div className='flex flex-wrap items-center gap-2 text-xs text-foreground-muted'>
      <Badge variant={localContextFiles.length > 0 ? 'success' : 'neutral'}>{localContextFiles.length} local</Badge>
      {localContextLabel ? <span className='truncate'>{localContextLabel}</span> : null}
    </div>
    <Visible when={resolvedContextReferences.length > 0}>
      <div className='overflow-hidden rounded-control border border-surface-border/60 bg-surface-panel/35'>
        <div className='grid grid-cols-[minmax(0,1fr)_7rem] gap-2 border-b border-surface-border/60 px-3 py-2 text-xs font-medium text-foreground-muted'>
          <span>Detected</span>
          <span>Status</span>
        </div>
        <div className='max-h-56 overflow-auto'>
          {resolvedContextReferences.map(reference => (
            <div
              key={reference.reference.id}
              className='grid grid-cols-[minmax(0,1fr)_7rem] gap-2 border-b border-surface-border/40 px-3 py-2 last:border-b-0'
            >
              <div className='min-w-0'>
                <div className='truncate font-mono text-xs font-medium'>
                  {reference.contextPath ?? reference.reference.source}
                </div>
                <div className='truncate text-xs text-foreground-muted'>
                  {reference.reference.instruction} line {reference.reference.lineNumber}: {reference.message}
                </div>
              </div>
              <Badge
                variant={detectedContextStatusVariant(reference.status)}
                className='w-fit self-start'
              >
                {reference.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </Visible>
    <Visible when={detectedUploadableCount > 0}>
      <Button
        type='button'
        variant='primary'
        disabled={isUploadingDetectedContext}
        onClick={onUploadDetectedContext}
      >
        {isUploadingDetectedContext ? <IconLoader2 className='size-4 animate-spin' /> : <IconUpload />}
        {detectedContextUploadLabel}
      </Button>
    </Visible>
    <FormField
      label='Path'
      layout='vertical'
      className={verticalSettingClassName}
    >
      <Input
        value={uploadPath}
        onChange={event => onUploadPathChange(event.target.value)}
      />
    </FormField>
    <Input
      type='file'
      onChange={(event: ChangeEvent<HTMLInputElement>) => onUploadFileChange(event.target.files?.[0] ?? null)}
    />
    <Button
      type='button'
      variant='secondary'
      disabled={!uploadFile || isUploading}
      onClick={onUpload}
    >
      {isUploading ? <IconLoader2 className='size-4 animate-spin' /> : <IconUpload />}
      {uploadProgress === null ? 'Upload' : `Upload ${uploadProgress}%`}
    </Button>
    <div className='grid gap-2'>
      {availableContextFiles.map(file => (
        <div
          key={file.id}
          className='flex items-start gap-2 rounded-control border border-surface-border/60 bg-surface-panel/35 p-2'
        >
          <Checkbox
            checked={selectedContextFileIds.has(file.id)}
            onCheckedChange={checked => onToggleContextFile(file.id, checked === true)}
          />
          <div className='min-w-0 flex-1'>
            <div className='truncate font-mono text-xs font-medium'>{file.contextPath}</div>
            <div className='truncate text-xs text-foreground-muted'>{file.originalName}</div>
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon-md'
            onClick={() => onRemoveContextFile(file.id)}
          >
            <IconTrash className='size-4' />
          </Button>
        </div>
      ))}
    </div>
  </Section>
)
