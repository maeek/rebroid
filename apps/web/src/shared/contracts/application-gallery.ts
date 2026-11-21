import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type ApplicationGalleryRow = OrchestratorApiSchemas['AndroidApplicationGalleryRowDto'] & {
  ownerDisplayName: string | null
}

export type AppGalleryItem = Omit<ApplicationGalleryRow, 'updatedAt'> & {
  updatedAt: Date
  icon: string | null
  running: boolean
}

export const toAppGalleryItem = (row: ApplicationGalleryRow): AppGalleryItem => ({
  ...row,
  updatedAt: new Date(row.updatedAt),
  icon: null,
  running: row.status === 'running'
})
