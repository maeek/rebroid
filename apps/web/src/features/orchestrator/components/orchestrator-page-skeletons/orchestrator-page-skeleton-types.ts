export type ListColumnKind = 'stacked' | 'text' | 'badge' | 'actions' | 'action'

export type ListColumn = {
  width?: string
  headerWidth: string
  kind?: ListColumnKind
  cellWidth?: string
}
