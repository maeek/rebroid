'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { firewallServiceSettingsSchema } from '@/shared/contracts/firewall-service-settings'
import { ocrServiceSettingsSchema } from '@/shared/contracts/ocr-service-settings'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { saveOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { ServiceDetailLayout } from '@/shared/ui/platform/service-detail-layout'
import { ResourceLink } from '@/shared/ui/resource-link'
import { OcrServiceFields } from './ocr-service-fields'
import { ServiceConnectionSection } from './service-connection-section'
import { serviceMeta, type ServiceId } from './service-definitions'
import { ServicesPageActions } from './services-page-actions'
import type { ServiceContainer, ServiceHealth } from '@/shared/contracts/diagnostics'
import type { OcrServiceUiSettings, OptionalServicesUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const settingsSchemas: { [Id in ServiceId]: z.ZodType<OptionalServicesUiSettings[Id]> } = {
  ocr: ocrServiceSettingsSchema,
  firewall: firewallServiceSettingsSchema
}

export const ServiceSettingsPage = <Id extends ServiceId>({
  serviceId,
  initialHealth,
  initialSettings,
  container,
  requestId,
  loading = false,
  children
}: {
  serviceId: Id
  initialHealth?: ServiceHealth
  initialSettings?: OptionalServicesUiSettings[Id]
  container?: ServiceContainer
  requestId?: string
  loading?: boolean
  children?: ReactNode
}) => {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ draft: initialSettings, saved: initialSettings })
  const snapshot = useRef(JSON.stringify(initialSettings))
  const { isFeatureEnabled } = useFeatureFlags()
  const meta = serviceMeta[serviceId]
  const serviceName = serviceId === 'ocr' ? 'OCR' : 'Firewall'
  const enabled = isFeatureEnabled(meta.featureKey)
  const unavailable = !initialSettings
  const disabled = loading || saving || unavailable || !enabled
  const { draft, saved } = form
  const saveFeedback = useSaveFeedback(JSON.stringify(draft))
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(saved)
  const settings = draft ?? defaultOrchestratorUiSettings.services[serviceId]
  const parsed = settingsSchemas[serviceId].safeParse(draft && { ...draft, endpoint: draft.endpoint?.trim() || null })
  const errors = parsed.success || disabled ? undefined : z.flattenError(parsed.error).fieldErrors

  useEffect(() => {
    if (!initialSettings) return
    const next = JSON.stringify(initialSettings)
    if (snapshot.current === next) return
    snapshot.current = next
    setForm(current => ({
      saved: initialSettings,
      draft: JSON.stringify(current.draft) === JSON.stringify(current.saved) ? initialSettings : current.draft
    }))
  }, [initialSettings])

  const refresh = () => startRefresh(() => router.refresh())
  const changeSettings = (patch: Partial<OcrServiceUiSettings>) =>
    setForm(current => ({ ...current, draft: current.draft && { ...current.draft, ...patch } }))

  const save = async () => {
    if (disabled || !hasChanges || !parsed.success) return
    saveFeedback.resetSaveFeedback()
    setSaving(true)
    try {
      const services: Partial<OptionalServicesUiSettings> = {}
      services[serviceId] = parsed.data
      const result = await saveOrchestratorUiSettings({ services })
      const savedSettings = result.services[serviceId]
      setForm({ draft: savedSettings, saved: savedSettings })
      saveFeedback.confirmSaved(JSON.stringify(savedSettings))
      toast({ title: `${serviceName} settings saved`, variant: 'success' })
      refresh()
    } catch (error) {
      toast({
        title: `Could not save ${serviceName} settings`,
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ServiceDetailLayout
      title={serviceId === 'firewall' ? 'Firewall' : meta.title}
      navigation={{ section: { label: 'Administration' } }}
      loading={loading}
      health={unavailable ? undefined : initialHealth}
      healthNotice={{
        title: unavailable ? `${serviceName} settings unavailable` : undefined,
        description: unavailable ? 'Refresh to reconnect and load the service configuration.' : undefined,
        requestId,
        actions:
          !unavailable && !enabled ? (
            <ResourceLink href={`/platform/features#${meta.featureKey}`}>Manage feature</ResourceLink>
          ) : undefined
      }}
      refresh={
        <PlatformPageRefreshButton
          disabled={loading || saving}
          isRefreshing={refreshing}
          onRefresh={refresh}
        />
      }
      actions={
        loading || (enabled && (draft || initialSettings)) ? (
          <ServicesPageActions
            disabled={disabled}
            saveDisabled={!parsed.success}
            hasChanges={hasChanges}
            saving={saving}
            saved={saveFeedback.saved}
            onSave={() => void save()}
            onDiscard={() => setForm(current => ({ ...current, draft: current.saved }))}
          />
        ) : undefined
      }
    >
      {loading || draft ? (
        <>
          <ServiceConnectionSection
            serviceId={serviceId}
            settings={settings}
            container={settings.endpoint === initialSettings?.endpoint ? container : undefined}
            disabled={disabled}
            loading={loading}
            errors={errors}
            onChange={changeSettings}
          />
          {'maxImageDimension' in settings ? (
            <OcrServiceFields
              settings={settings}
              disabled={disabled}
              loading={loading}
              errors={errors}
              onChange={changeSettings}
            />
          ) : null}
        </>
      ) : null}
      {children}
    </ServiceDetailLayout>
  )
}
