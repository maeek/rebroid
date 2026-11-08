'use client'

import type { ReactNode } from 'react'
import { EditorFormContext } from '@/components/ui/editor-form-context'
import { cn } from '@/lib/utils'

/** Shared section-based editor geometry for ready and loading states. */
export const EditorPage = ({
  children,
  className,
  width = 'full'
}: {
  children: ReactNode
  className?: string
  width?: 'form' | 'full'
}) => (
  <EditorFormContext.Provider value={true}>
    <div
      data-editor=''
      className={cn('editor-page flex w-full flex-col', width === 'form' && 'max-w-[56rem]', className)}
    >
      {children}
    </div>
  </EditorFormContext.Provider>
)
