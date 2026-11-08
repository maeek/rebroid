'use client'

import { createContext, type ReactNode } from 'react'

export const FormLoadingContext = createContext(false)

export const FormLoadingBoundary = ({ children }: { children: ReactNode }) => (
  <FormLoadingContext.Provider value={true}>
    <div
      aria-busy='true'
      inert
      className='w-full min-w-0'
    >
      {children}
    </div>
  </FormLoadingContext.Provider>
)
