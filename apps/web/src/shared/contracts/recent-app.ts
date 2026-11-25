export type RecentApp = {
  id: string
  name: string
  href?: string
  connectionHref?: string
  kindLabel?: string
  icon?: string | null
  openedAt: number
  status?: 'provisioning' | 'running' | 'stopped' | 'error' | 'removing' | 'removed'
  statusLabel?: string | null
  ownerDisplayName?: string | null
  canStart?: boolean
  canStop?: boolean
  canClone?: boolean
  canViewSnapshot?: boolean
}
