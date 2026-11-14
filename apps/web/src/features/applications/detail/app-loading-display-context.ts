'use client'

import { createContext } from 'react'
import type { DisplaySize } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const AppLoadingDisplayContext = createContext<Promise<DisplaySize | null> | null>(null)
