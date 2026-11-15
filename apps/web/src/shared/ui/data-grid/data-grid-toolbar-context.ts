import { createContext } from 'react'

// Undefined uses the table header. Null reserves a toolbar slot before its node mounts.
export const DataGridColumnToolbarContext = createContext<HTMLDivElement | null | undefined>(undefined)
