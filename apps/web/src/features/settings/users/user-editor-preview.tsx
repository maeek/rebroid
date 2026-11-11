import { defaultUserQuota } from '@/shared/permissions/permissions'
import { GroupEditPage } from './group-edit-page'
import { UserEditPage } from './user-edit-page'
import type { PublicUser, UserGroup } from '@/shared/contracts/auth-user'

const group: UserGroup = {
  id: 'preview-group',
  name: 'Operators',
  description: 'Platform operators',
  permissions: { 'applications:create': true, 'applications:start': true, 'applications:view-logs': true },
  quotas: defaultUserQuota,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}
const auditorGroup: UserGroup = {
  ...group,
  id: 'preview-auditors',
  name: 'Auditors',
  description: 'Read application logs and diagnostics',
  permissions: { 'applications:view-logs': true, 'applications:create': false }
}
const previewGroups: UserGroup[] = [
  group,
  auditorGroup,
  ...Array.from({ length: 12 }, (_, index) => ({
    ...group,
    id: `team-${index}`,
    name: `Operations team ${index + 1}`,
    description: `Manage regional applications and devices for team ${index + 1}.`
  }))
]

const user: PublicUser = {
  id: 'preview-user',
  username: 'operator',
  name: 'Platform operator',
  isPlatformAdmin: false,
  groupIds: previewGroups.slice(0, 12).map(item => item.id),
  disabled: false,
  passwordChangeRequired: false,
  mfaEnabled: false,
  sessionVersion: 1,
  avatarDataUrl: null,
  accentColor: 'blue',
  effectivePermissions: {},
  effectiveQuotas: defaultUserQuota,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

export const UserEditorPreview = ({ kind }: { kind: 'user' | 'group' }) => (
  <main className='min-h-screen bg-background pt-(--console-top-inset)'>
    {kind === 'user' ? (
      <UserEditPage
        user={user}
        groups={previewGroups}
      />
    ) : (
      <GroupEditPage group={group} />
    )}
  </main>
)
