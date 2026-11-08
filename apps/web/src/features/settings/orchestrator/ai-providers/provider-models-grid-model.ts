import type { ProviderModelRow } from './provider-form-model'

export const selectedProviderModelIndexes = (rows: ProviderModelRow[], selectedIds: Set<string>) =>
  rows.filter(model => selectedIds.has(model.rowId)).map(model => model.index)

export const findProviderModelSettingsRow = (rows: ProviderModelRow[], rowId: string | null) =>
  rows.find(model => model.rowId === rowId) ?? null
