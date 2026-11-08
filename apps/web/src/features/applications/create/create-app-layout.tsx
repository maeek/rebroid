'use client'
import type { ReactNode } from 'react'
import { EditorFormContext } from '@/components/ui/editor-form-context'
export const CreateAppLayout = ({ children }: { children: ReactNode }) => (
  <EditorFormContext.Provider value={true}>
    <div className='flex w-full flex-col gap-6 pb-16'>{children}</div>
  </EditorFormContext.Provider>
)
