export type ContainerResourceView = 'overview' | 'logs' | 'terminal'

export const readContainerResourceView = (view: unknown): ContainerResourceView =>
  view === 'logs' || view === 'terminal' ? view : 'overview'

export const containerResourceHref = (id: string, view: ContainerResourceView = 'overview') =>
  `/runtime/containers/${encodeURIComponent(id)}${view === 'overview' ? '' : `?view=${view}`}`
