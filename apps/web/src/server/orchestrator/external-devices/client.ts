import 'server-only'
import { openAppQuotaHeaders } from '../applications/open-app-quota'
import { emptyRequest, jsonRequest } from '../request'
import type {
  ExternalDevice,
  ExternalDeviceAvailability,
  ExternalDeviceLogcat,
  ExternalDeviceScreenshot,
  ExternalTcpCheck,
  ExternalUsbCandidate,
  ExternalVerificationInstructions,
  ExternalViewerSession,
  ExternalViewerTarget
} from '@/shared/contracts/external-device'
import type { ExternalDeviceVerificationProof } from '@rebroid/android-application-core/android-device'

interface Actor {
  userId: string
  administrator: boolean
  canEnroll?: boolean
  canUse?: boolean
}
const headersFor = (actor: Actor) => ({
  'x-rebroid-device-user': actor.userId,
  'x-rebroid-device-admin': String(actor.administrator),
  ...(actor.canEnroll && { 'x-rebroid-device-enroll': 'true' }),
  ...(actor.canUse && { 'x-rebroid-device-use': 'true' })
})
const base = '/devices/external'
const path = (id: string) => `${base}/${encodeURIComponent(id)}`
const attachmentPath = (id: string, attachmentId: string) =>
  `${path(id)}/attachments/${encodeURIComponent(attachmentId)}`
// Each owner-only caller verifies the account's use grant before creating these headers.
type Owner = Pick<Actor, 'userId' | 'administrator'>
const ownerHeaders = (owner: Owner) => headersFor({ ...owner, canUse: true })

export const externalDeviceClient = {
  availability: () => emptyRequest<ExternalDeviceAvailability>(`${base}/availability`),
  list: (actor: Actor) => emptyRequest<ExternalDevice[]>(base, { headers: headersFor(actor) }),
  get: (id: string, actor: Actor, signal?: AbortSignal) =>
    emptyRequest<ExternalDevice>(path(id), { headers: headersFor(actor), signal }),
  candidates: (actor: Actor) =>
    emptyRequest<ExternalUsbCandidate[]>(`${base}/usb-candidates`, { headers: headersFor(actor) }),
  checkTcp: (endpoint: string, actor: Actor) =>
    jsonRequest<ExternalTcpCheck>(`${base}/tcp-check`, 'POST', { endpoint }, { headers: headersFor(actor) }),
  register: (input: unknown, actor: Actor) =>
    jsonRequest<ExternalDevice>(base, 'POST', input, { headers: headersFor(actor) }),
  command: (
    id: string,
    action: 'connect' | 'refresh' | 'disconnect',
    actor: Actor,
    quotas?: { maxOpenApps: number | null; maxSessionSeconds: number | null }
  ) =>
    emptyRequest<ExternalDevice>(`${path(id)}/${action}`, {
      method: 'POST',
      headers: {
        ...headersFor(actor),
        ...openAppQuotaHeaders(quotas?.maxOpenApps),
        ...(quotas?.maxSessionSeconds != null && {
          'x-rebroid-max-session-seconds': String(
            Math.min(Math.ceil(quotas.maxSessionSeconds), Number.MAX_SAFE_INTEGER)
          )
        })
      }
    }),
  instructions: (id: string, attemptId: string, actor: Actor) =>
    emptyRequest<ExternalVerificationInstructions>(`${path(id)}/verification?${new URLSearchParams({ attemptId })}`, {
      headers: headersFor(actor)
    }),
  verify: (id: string, attemptId: string, proof: ExternalDeviceVerificationProof, actor: Actor) =>
    jsonRequest<ExternalDevice>(`${path(id)}/verify`, 'POST', { attemptId, proof }, { headers: headersFor(actor) }),
  forget: (id: string, actor: Actor) =>
    emptyRequest<{ id: string }>(path(id), { method: 'DELETE', headers: headersFor(actor) }),
  attachment: (id: string, attachmentId: string, owner: Owner, signal?: AbortSignal) =>
    emptyRequest<ExternalViewerTarget>(attachmentPath(id, attachmentId), { headers: ownerHeaders(owner), signal }),
  viewer: (id: string, attachmentId: string, owner: Owner, grants: string[]) =>
    jsonRequest<ExternalViewerSession>(
      `${path(id)}/viewer`,
      'POST',
      { attachmentId, grants },
      {
        headers: ownerHeaders(owner)
      }
    ),
  screenshot: (id: string, attachmentId: string, owner: Owner) =>
    emptyRequest<ExternalDeviceScreenshot>(`${attachmentPath(id, attachmentId)}/screenshot`, {
      headers: ownerHeaders(owner)
    }),
  logcat: (id: string, attachmentId: string, owner: Owner) =>
    emptyRequest<ExternalDeviceLogcat>(`${attachmentPath(id, attachmentId)}/logcat`, {
      headers: ownerHeaders(owner)
    })
}
