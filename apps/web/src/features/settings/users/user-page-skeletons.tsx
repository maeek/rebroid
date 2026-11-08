'use client'

import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { AccessEditorLayout } from './components/access-editor-layout'
import { GroupMembershipEditor } from './components/group-membership-editor'
import { GroupDetailsSections, UserAccountSections } from './components/identity-fields'
import { PermissionEditor } from './components/permission-editor'
import { QuotaFields } from './components/quota-fields'
import { GroupsSettings } from './groups-settings'
import { UsersSettings } from './users-settings'

const UsersHeaderSkeleton = ({
  title,
  description,
  trail = [],
  withAvatar = false
}: {
  title: string
  description: string
  trail?: Array<{ label: string; href?: string }>
  withAvatar?: boolean
}) => (
  <PageHeader
    section={{ label: 'Security' }}
    trail={trail}
    title={<Skeleton className='h-9 w-48 max-w-[50vw] max-sm:h-7' />}
    breadcrumbLabel={title}
    actions={
      <Button disabled>
        <IconDeviceFloppy className='size-4' />
        Save {withAvatar ? 'User' : 'Group'}
      </Button>
    }
    description={description}
    leading={withAvatar ? <Skeleton className='size-12 rounded-full max-sm:size-10' /> : undefined}
  />
)

export const UsersPageSkeleton = () => (
  <UsersSettings
    initialUsers={[]}
    initialGroups={[]}
    initialPasswordMinimumLength={12}
    loading
  />
)

export const GroupsPageSkeleton = () => (
  <GroupsSettings
    initialGroups={[]}
    loading
  />
)

export const UserEditPageSkeleton = () => (
  <EditorPage className='gap-2'>
    <UsersHeaderSkeleton
      trail={[{ label: 'Users', href: '/security/users' }]}
      title='User'
      description='Account settings, quotas, groups, and permissions.'
      withAvatar
    />
    <EditBodySkeleton variant='user' />
  </EditorPage>
)

export const GroupEditPageSkeleton = () => (
  <EditorPage className='gap-2'>
    <UsersHeaderSkeleton
      trail={[{ label: 'Groups', href: '/security/groups' }]}
      title='Group'
      description='Default permissions and quotas for group members.'
    />
    <EditBodySkeleton variant='group' />
  </EditorPage>
)

const EditBodySkeleton = ({ variant }: { variant: 'user' | 'group' }) => (
  <PageContent>
    <AccessEditorLayout
      identity={
        <FormLoadingBoundary>
          {variant === 'user' ? <UserAccountSections disabled /> : <GroupDetailsSections disabled />}
        </FormLoadingBoundary>
      }
      loading
      access={
        variant === 'user' ? (
          <GroupMembershipEditor
            groups={[]}
            selectedGroupIds={[]}
            onChange={() => undefined}
            loading
          />
        ) : undefined
      }
      permissions={
        <PermissionEditor
          permissions={{}}
          inheritedPermissions={variant === 'user' ? {} : undefined}
          loading
          onChange={() => undefined}
        />
      }
      quotas={
        <FormLoadingBoundary>
          <QuotaFields
            quotas={{}}
            onChange={() => undefined}
          />
        </FormLoadingBoundary>
      }
    />
  </PageContent>
)
