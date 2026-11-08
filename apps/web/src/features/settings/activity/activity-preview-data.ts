import type { ActivityEventsTableProps } from './activity-types'
import type { AuditEvent } from '@/shared/contracts/audit'

export const previewAuditEvent: AuditEvent = {
  id: 42,
  actorLabel: 'Alex Morgan',
  actorUserId: 'alex',
  action: 'automation.trigger.update',
  category: 'application',
  resourceType: 'automation',
  resourceLabel: 'Nightly inventory sync',
  resourceId: 'trigger-8646f9d2-2b10-4be0-a960-33792a0618fb',
  outcome: 'success',
  details: { enabled: true, schedule: { frequency: 'daily', time: '03:00' } },
  sourceIp: '192.0.2.10',
  userAgent: 'Example browser',
  createdAt: '2026-11-08T09:17:19.369Z'
}

export const previewActivityProps: ActivityEventsTableProps = {
  auditRetentionDays: 30,
  filters: {},
  sorting: [{ id: 'createdAt', desc: true }],
  facets: {
    actors: [
      { id: 'alex', label: 'Alex Morgan' },
      { id: 'admin', label: 'Admin' }
    ],
    categories: ['application', 'auth', 'settings'],
    actions: ['automation.trigger.update', 'application.start', 'settings.features.update', 'auth.login.success'],
    resourceTypes: ['automation', 'application', 'feature_flags']
  },
  result: {
    page: 1,
    pageSize: 20,
    total: 4,
    summary: { success: 3, failure: 1, lastEventAt: previewAuditEvent.createdAt },
    events: [
      previewAuditEvent,
      {
        ...previewAuditEvent,
        id: 41,
        action: 'application.start',
        resourceType: 'application',
        resourceLabel: 'Reports worker',
        resourceId: 'app-reports',
        outcome: 'failure',
        details: { reason: 'Android boot timed out', requestId: 'request-41' },
        createdAt: '2026-11-08T09:17:18.100Z'
      },
      {
        ...previewAuditEvent,
        id: 40,
        action: 'settings.features.update',
        category: 'settings',
        resourceType: 'feature_flags',
        resourceLabel: null,
        resourceId: 'feature_flags',
        details: {},
        createdAt: '2026-11-08T09:15:16.101Z'
      },
      {
        ...previewAuditEvent,
        id: 39,
        action: 'auth.login.success',
        actorUserId: 'admin',
        actorLabel: 'Admin',
        category: 'auth',
        resourceType: null,
        resourceId: null,
        resourceLabel: null,
        details: {},
        createdAt: '2026-11-08T09:10:08.000Z'
      }
    ]
  }
}
