export function retainVisibleSelectedIds(rows: readonly { id: string }[], selectedIds: Set<string>) {
  if (!selectedIds.size) return selectedIds
  const visible = new Set(rows.map(row => row.id))
  const retained = new Set([...selectedIds].filter(id => visible.has(id)))
  return retained.size === selectedIds.size ? selectedIds : retained
}
