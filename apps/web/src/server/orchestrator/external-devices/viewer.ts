import 'server-only'
import { isCurrentAccountSession } from '@/server/auth/account-sessions'
import { getCurrentSessionIdentity, getCurrentUser } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { PublicActionError } from '@/server/errors/public-action-error'
import { viewerCapabilitiesFor } from '@/server/orchestrator/applications/viewer-capabilities'
import { assertViewerRevocationComplete } from '@/server/orchestrator/applications/viewer-grant-access'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { loadFeatureFlags } from '@/server/orchestrator/features'
import { getWebSettings } from '@/server/web-settings/store'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { externalDeviceClient } from './client'

const forbidden = () =>
  new PublicActionError('You lack access to this device attachment.', {
    code: 'forbidden',
    status: 403
  })

const canUseExternalDevice = (account: { isPlatformAdmin: boolean; effectivePermissions: PermissionMap }) =>
  account.isPlatformAdmin || hasPermission(account.effectivePermissions, 'devices:use-external')

export async function loadExternalViewer(id: string, attachmentId: string) {
  const [account, identity] = await Promise.all([getCurrentUser(), getCurrentSessionIdentity()])
  if (!canUseExternalDevice(account) || !isCurrentAccountSession(account, identity)) throw forbidden()
  assertViewerRevocationComplete(account.id, 'external')
  const owner = { userId: account.id, administrator: account.isPlatformAdmin }
  const device = await externalDeviceClient.get(id, owner)
  if (device.ownerUserId !== account.id) throw forbidden()
  const capabilities = viewerCapabilitiesFor(account.effectivePermissions)
  const grants = Object.entries(capabilities)
    .filter(([, allowed]) => allowed)
    .map(([grant]) => grant)
  const session = await externalDeviceClient.viewer(id, attachmentId, owner, grants)
  const current = await userService.getUserById(account.id)
  if (
    !current ||
    current.passwordChangeRequired ||
    (device.transport === 'usb' && !current.isPlatformAdmin) ||
    !canUseExternalDevice(current) ||
    !isCurrentAccountSession(current, identity)
  )
    throw forbidden()
  const currentCapabilities = viewerCapabilitiesFor(current.effectivePermissions)
  if (
    (capabilities.control && !currentCapabilities.control) ||
    (capabilities.clipboard && !currentCapabilities.clipboard) ||
    (capabilities.screenshot && !currentCapabilities.screenshot)
  )
    throw forbidden()
  assertViewerRevocationComplete(account.id, 'external')
  const canRun = hasPermission(current.effectivePermissions, 'automations:run')
  const flags = canRun ? await loadFeatureFlags() : null
  const enabled = (key: string) => flags?.features.some(feature => feature.key === key && feature.effective) === true
  const workflows = enabled('feature.workflows')
    ? await orchestratorAutomationsClient.listRunnableOptions(account.id).catch(() => [])
    : []
  const canUseAi =
    enabled('feature.ai') &&
    capabilities.screenshot &&
    hasPermission(current.effectivePermissions, 'automations:run-ai')
  return {
    name: device.name,
    deviceId: device.id,
    attachmentId,
    session,
    canControl: capabilities.control,
    canClipboard: capabilities.clipboard,
    canScreenshot: capabilities.screenshot,
    canUseAi,
    canDraftWorkflow: enabled('feature.workflows') && hasPermission(current.effectivePermissions, 'automations:manage'),
    contextualSuggestionsEnabled: canUseAi && (await getWebSettings()).aiContextualSuggestionsEnabled,
    workflows,
    canViewLogs: hasPermission(current.effectivePermissions, 'applications:view-logs')
  }
}

export async function runExternalViewerTool(id: string, attachmentId: string, action: 'screenshot' | 'logcat') {
  const [account, identity] = await Promise.all([getCurrentUser('api'), getCurrentSessionIdentity()])
  const permission = action === 'screenshot' ? 'applications:capture-screenshot' : 'applications:view-logs'
  const assertAccess = (current: typeof account | null) => {
    if (
      !current ||
      current.passwordChangeRequired ||
      !canUseExternalDevice(current) ||
      !hasPermission(current.effectivePermissions, permission) ||
      !isCurrentAccountSession(current, identity)
    )
      throw forbidden()
    assertViewerRevocationComplete(current.id, 'external')
  }
  assertAccess(account)
  const result = await externalDeviceClient[action](id, attachmentId, {
    userId: account.id,
    administrator: account.isPlatformAdmin
  })
  const current = await userService.getUserById(account.id)
  assertAccess(current)
  if (current?.isPlatformAdmin !== account.isPlatformAdmin) throw forbidden()
  return result
}
