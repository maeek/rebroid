export const appResourceLabels = {
  overview: 'Overview',
  configuration: 'Configuration',
  activity: 'Activity',
  diagnostics: 'Diagnostics',
  'ai-agent': 'AI agent',
  workflows: 'Workflows',
  clipboard: 'Clipboard',
  files: 'Files',
  profiles: 'Profiles'
} as const
export type AppResourceView = keyof typeof appResourceLabels
export const appResourceHref = (appId: string, view: AppResourceView = 'overview') => {
  const base = `/app/${encodeURIComponent(appId)}`
  return view === 'overview' ? base : `${base}?view=${view}`
}
