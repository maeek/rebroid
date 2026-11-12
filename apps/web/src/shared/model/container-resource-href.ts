export const containerResourceHref = (id: string, view: 'overview' | 'logs' = 'overview') =>
  `/runtime/containers/${encodeURIComponent(id)}${view === 'logs' ? '?view=logs' : ''}`
