export const appResourceLabels = {
  overview: 'Overview',
  configuration: 'Configuration',
  network: 'Network',
  activity: 'Activity',
  diagnostics: 'Diagnostics',
  'ai-agent': 'AI agent',
  workflows: 'Workflows',
  files: 'Files',
  profiles: 'Profiles'
} as const
export type AppResourceView = keyof typeof appResourceLabels
export const resolveAppResourceView = (view: string | null): AppResourceView =>
  view && Object.hasOwn(appResourceLabels, view) ? (view as AppResourceView) : 'overview'

export const appResourceHref = (appId: string, view: AppResourceView = 'overview') => {
  const base = `/app/${encodeURIComponent(appId)}`
  return view === 'overview' ? base : `${base}?view=${view}`
}
