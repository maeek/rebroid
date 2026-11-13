export type RecentApp = {
  id: string
  name: string
  icon?: string | null
  openedAt: number
  status?: 'provisioning' | 'running' | 'stopped' | 'error' | 'removing' | 'removed'
  statusLabel?: string | null
  ownerDisplayName?: string | null
  canStart?: boolean
  canStop?: boolean
  canClone?: boolean
}
