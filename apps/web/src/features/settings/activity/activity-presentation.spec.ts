import { describe, expect, it } from 'vitest'
import {
  auditActionLabel,
  auditActorLabel,
  auditValueLabel,
  auditTargetLabel
} from '@/shared/model/audit-event-presentation'
import { previewAuditEvent } from './activity-preview-data'

describe('audit event presentation', () => {
  it('names operations without claiming that failed attempts completed', () => {
    expect(auditActionLabel('application.start')).toBe('Start application')
    expect(auditActionLabel('automation.trigger.update')).toBe('Update trigger')
    expect(auditActionLabel('settings.features.update')).toBe('Update platform features')
    expect(auditActionLabel('auth.primary_credentials.success')).toBe('Verify sign-in credentials')
  })

  it('keeps unknown actions readable without hiding new vocabulary', () => {
    expect(auditActionLabel('application.apk.update')).toBe('Application APK update')
    expect(auditValueLabel('future_event.type')).toBe('Future event type')
    expect(auditActionLabel('constructor')).toBe('Constructor')
  })

  it('handles absent resource metadata without hiding legitimate resource names', () => {
    expect(auditTargetLabel({ ...previewAuditEvent, resourceLabel: null, resourceType: null, resourceId: null })).toBe(
      '—'
    )
    expect(auditTargetLabel({ ...previewAuditEvent, resourceLabel: null, resourceType: 'feature_flags' })).toBe(
      'Feature flags'
    )
    expect(auditTargetLabel(previewAuditEvent)).toBe('Nightly inventory sync')
    expect(auditTargetLabel({ ...previewAuditEvent, resourceLabel: 'none' })).toBe('none')
    expect(auditTargetLabel({ ...previewAuditEvent, resourceLabel: null, resourceType: null })).toBe(
      previewAuditEvent.resourceId
    )
  })

  it('uses the actor name with safe fallbacks', () => {
    expect(auditActorLabel(previewAuditEvent)).toBe('Alex Morgan')
    expect(auditActorLabel({ ...previewAuditEvent, actorLabel: '', actorUserId: null })).toBe('System')
  })
})
