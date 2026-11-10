export const sidebarCollapsedCookie = 'rebroid-sidebar-collapsed'
export const legacySidebarCollapsedKey = 'rebroid:sidebar-collapsed'

export const parseSidebarCollapsed = (value: string | undefined) => {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}
