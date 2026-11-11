import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import {
  administratorsGroupId,
  defaultUserGroupId,
  resolveEffectiveAccess
} from '@/shared/permissions/effective-access'
import {
  allPermissionIds,
  defaultUserPermissions,
  defaultUserQuota,
  fullPermissions,
  normalizeGroupQuota,
  unlimitedQuota,
  type PermissionMap,
  type ResourceQuota
} from '@/shared/permissions/permissions'
import type { PublicUser, UserGroup } from '@/shared/contracts/auth-user'

export type StoredUser = Omit<
  PublicUser,
  'effectivePermissions' | 'effectiveQuotas' | 'isPlatformAdmin' | 'mfaEnabled'
> & {
  passwordHash: string
  mfaSecretEncrypted: string | null
  mfaRecoveryCodeHashes: string[]
}

export type UsersFile = {
  users: StoredUser[]
  groups: UserGroup[]
}

export const defaultPasswordMinimumLength = 8

const maxAvatarBytes = 2 * 1024 * 1024

export const nowIso = () => new Date().toISOString()

export const validateAvatarDataUrl = (avatarDataUrl: string | null | undefined) => {
  if (!avatarDataUrl) {
    return
  }
  const match = avatarDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/)
  if (!match || Buffer.from(match[2], 'base64').length > maxAvatarBytes) {
    throw new PublicActionError('Avatar must be a PNG, JPEG, or WebP image no larger than 2 MB.', {
      code: 'validation',
      status: 422
    })
  }
}

export const defaultGroups = (): UserGroup[] => {
  const now = nowIso()
  return [
    {
      id: administratorsGroupId,
      name: 'Administrators',
      description: 'Full platform access.',
      permissions: fullPermissions,
      quotas: unlimitedQuota,
      createdAt: now,
      updatedAt: now
    },
    {
      id: defaultUserGroupId,
      name: 'Users',
      description: 'Standard app owners with bounded resources.',
      permissions: defaultUserPermissions,
      quotas: defaultUserQuota,
      createdAt: now,
      updatedAt: now
    }
  ]
}

export const toPublicUser = (file: UsersFile, user: StoredUser): PublicUser => {
  const { groups, decisions, isPlatformAdmin, quotas } = resolveEffectiveAccess(file.groups, user.groupIds)
  const effectivePermissions = Object.fromEntries(
    Object.entries(decisions).map(([id, decision]) => [id, decision.allowed])
  )
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    isPlatformAdmin,
    groupIds: groups.map(group => group.id),
    disabled: user.disabled,
    passwordChangeRequired: user.passwordChangeRequired,
    mfaEnabled: Boolean(user.mfaSecretEncrypted),
    sessionVersion: user.sessionVersion,
    avatarDataUrl: user.avatarDataUrl,
    accentColor: user.accentColor,
    effectivePermissions,
    effectiveQuotas: quotas,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

const groupIdsSchema = z.array(z.string())

export const validateGroupIds = (groups: readonly UserGroup[], groupIds: unknown): string[] => {
  const knownIds = new Set(groups.map(group => group.id))
  const parsed = groupIdsSchema.safeParse(groupIds)
  if (!parsed.success || parsed.data.some(id => !knownIds.has(id))) {
    throw new PublicActionError('Select existing groups.', { code: 'validation', status: 422 })
  }
  return [...new Set(parsed.data)]
}

export const groupPermissionsSchema = z.partialRecord(z.enum(allPermissionIds), z.boolean())
export const groupQuotaSchema = z.object({
  maxOpenApps: z.number().nonnegative().int().nullable().optional(),
  maxSessionSeconds: z.number().nonnegative().int().nullable().optional(),
  maxMemoryMb: z.number().nonnegative().int().nullable().optional(),
  maxCpuCpus: z.number().nonnegative().nullable().optional()
})

export const validateGroupPolicy = (permissions: PermissionMap, quotas: Partial<ResourceQuota>) => {
  const parsedPermissions = groupPermissionsSchema.safeParse(permissions)
  const parsedQuotas = groupQuotaSchema.safeParse(quotas)
  if (!parsedPermissions.success || !parsedQuotas.success) {
    throw new PublicActionError('Check the group permissions and quotas.', { code: 'validation', status: 422 })
  }
  return { permissions: parsedPermissions.data, quotas: normalizeGroupQuota(parsedQuotas.data) }
}
