import type { AuditEvent } from '@/shared/contracts/audit'

const terms: Record<string, string> = {
  ai: 'AI',
  apk: 'APK',
  adb: 'ADB',
  ip: 'IP',
  mfa: 'MFA',
  totp: 'TOTP',
  url: 'URL'
}

const activityTerm = (value: string) =>
  value
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map(word => {
      const term = word.toLowerCase()
      return Object.hasOwn(terms, term) ? terms[term] : term
    })
    .join(' ')

export const auditValueLabel = (value: string) => {
  const text = activityTerm(value)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const actionLabels: Record<string, string> = {
  'auth.login.success': 'Sign in',
  'auth.login.failure': 'Sign in',
  'auth.login.lockout': 'Sign-in lockout',
  'auth.sessions.revoke': 'Sign out sessions',
  'auth.primary_credentials.success': 'Verify sign-in credentials',
  'auth.primary_credentials.failure': 'Verify sign-in credentials',
  'settings.features.update': 'Update platform features',
  'settings.orchestrator.update': 'Update runtime defaults',
  'settings.orchestrator.reset': 'Restore runtime defaults',
  'settings.web.update': 'Update web settings',
  'audit.purge': 'Purge audit log',
  'audit.retention.update': 'Update audit retention'
}

const actionObjects: Record<string, string> = {
  application: 'application',
  automation: 'workflow',
  'automation.trigger': 'trigger',
  'settings.ai_provider': 'AI provider',
  'settings.ai_provider_model': 'AI model',
  user: 'user',
  group: 'group',
  'docker.container': 'container',
  'docker.image': 'image',
  'docker.network': 'network'
}

const actionVerbs = ['create', 'update', 'delete', 'start', 'stop', 'clone', 'remove']

export const auditActionLabel = (action: string) => {
  if (Object.hasOwn(actionLabels, action)) return actionLabels[action]
  const parts = action.split('.')
  const verb = parts.pop() ?? ''
  const scope = parts.join('.')
  const object = Object.hasOwn(actionObjects, scope) ? actionObjects[scope] : undefined
  if (object && actionVerbs.includes(verb)) {
    return `${auditValueLabel(verb)} ${object}`
  }
  return auditValueLabel(action)
}

export const auditActorLabel = (event: AuditEvent) =>
  event.actorUsername || event.actorLabel.trim() || event.actorUserId || 'System'

export const auditTargetLabel = (event: AuditEvent) => {
  const label = event.resourceLabel?.trim()
  if (label) return label
  if (event.resourceType) return auditValueLabel(event.resourceType)
  if (event.resourceId) return event.resourceId
  return '—'
}

const searchableActions = [
  ...Object.keys(actionLabels),
  ...Object.keys(actionObjects).flatMap(scope => actionVerbs.map(verb => `${scope}.${verb}`))
].map(action => ({ action, label: auditActionLabel(action).toLowerCase() }))

export const auditActionsMatchingSearch = (search: string) => {
  const text = search.trim().toLowerCase().replace(/\s+/g, ' ')
  return searchableActions.filter(item => item.label.includes(text)).map(item => item.action)
}
