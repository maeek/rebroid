import { useState, type DragEvent, type RefObject } from 'react'
import { IconFolderUp, IconLoader2 } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const RuntimeFileDropzone = ({
  currentPath,
  fileInputRef,
  isUploading,
  onFileUpload,
  runtimeAvailable,
  uploadFileName,
  uploadProgress
}: {
  currentPath: string
  fileInputRef: RefObject<HTMLInputElement | null>
  isUploading: boolean
  onFileUpload: (file: File | undefined) => void
  runtimeAvailable: boolean
  uploadFileName: string
  uploadProgress: number | null
}) => {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (!runtimeAvailable || isUploading) return
    onFileUpload(event.dataTransfer.files?.[0])
  }

  return (
    <>
      <Input
        ref={fileInputRef}
        type='file'
        className='hidden'
        onChange={event => onFileUpload(event.target.files?.[0])}
      />
      <button
        type='button'
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={event => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-24 w-full flex-col items-center justify-center gap-2 border-t border-dashed px-4 py-5 text-center transition',
          {
            'border-primary/70 bg-primary/10 text-foreground': isDragging,
            'border-surface-border/90 bg-surface-band/55 text-foreground-muted': !isDragging,
            'hover:border-primary/55 hover:bg-surface-band/45': !isUploading
          }
        )}
      >
        {isUploading ? <IconLoader2 className='size-6 animate-spin' /> : <IconFolderUp className='size-6' />}
        <span className='font-medium text-foreground'>
          {isUploading
            ? `Uploading ${uploadFileName || 'file'} (${uploadProgress ?? 0}%)`
            : 'Drop files here or click to upload'}
        </span>
        <span className='text-xs'>Files are copied into {currentPath}.</span>
      </button>
    </>
  )
}
