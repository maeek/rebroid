'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { fieldFeedbackClassName } from './feedback-motion'

export const FileDropZone = ({
  children,
  onFiles,
  disabled = false,
  description,
  className
}: {
  children: ReactNode
  onFiles: (files: File[]) => void
  disabled?: boolean
  description?: ReactNode
  className?: string
}) => {
  const depth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const reset = () => {
    depth.current = 0
    setDragging(false)
  }
  useEffect(() => {
    window.addEventListener('dragend', reset)
    window.addEventListener('drop', reset)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('dragend', reset)
      window.removeEventListener('drop', reset)
      window.removeEventListener('blur', reset)
    }
  }, [])
  useEffect(() => {
    if (disabled) reset()
  }, [disabled])
  const active = dragging && !disabled
  return (
    <div
      data-slot='file-drop-zone'
      className={cn('relative min-w-0', className)}
      onDragEnter={event => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        if (disabled) return
        depth.current += 1
        setDragging(true)
      }}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      }}
      onDrop={event => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        reset()
        if (!disabled && event.dataTransfer.files.length) onFiles(Array.from(event.dataTransfer.files))
      }}
    >
      {children}
      <div
        data-slot='file-drop-feedback'
        role='status'
        aria-label='File drop feedback'
        data-visible={active}
        aria-hidden={!active}
        className={cn(
          'pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-panel border-2 border-dashed border-primary bg-surface-elevated/95 text-center',
          fieldFeedbackClassName
        )}
      >
        <div className='grid min-w-0 gap-2 px-6'>
          <IconUpload
            aria-hidden
            className='mx-auto size-6 text-primary'
          />
          <div className='font-medium'>Drop files to upload</div>
          {description ? <div className='break-all text-sm text-foreground-muted'>{description}</div> : null}
        </div>
      </div>
    </div>
  )
}
