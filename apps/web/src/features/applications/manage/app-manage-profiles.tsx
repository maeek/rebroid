'use client'

import { useState } from 'react'
import { IconDatabase, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { editorSectionClassName } from '@/components/ui/surface'
import { Visible } from '@/components/ui/visible'
import { AppPageFailure } from '@/features/applications/components/app-page-failure'
import { useApplicationViewerContext } from '@/features/applications/detail/application-viewer-context'
import { useRemoveApplicationProfile } from '@/features/applications/manage/use-remove-application-profile'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { hasPermission } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageContent } from '@/shared/ui/page/page-layout'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppManageProfiles = () => {
  const { app, permissions } = useApplicationViewerContext()
  const removeProfile = useRemoveApplicationProfile()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const canDeleteProfiles = hasPermission(permissions, 'applications:delete')

  if (!app) {
    return <AppPageFailure />
  }

  const persistentProfiles = app.savedProfiles.filter(profile => profile.mode === 'persistent')
  const activeProfileName = app.profileMode === 'persistent' ? (app.profileName ?? 'default') : null

  const deleteProfile = async () => {
    if (!profileToDelete || deleting) {
      return
    }

    setDeleting(true)
    try {
      await removeProfile(profileToDelete)
      setProfileToDelete(null)
    } catch (error) {
      setDeleteError(getDisplayErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <EditorPage>
      <PageContent>
        <AppViewerHeading app={app} />
        <AppProfilesSection
          profiles={persistentProfiles}
          activeProfileName={activeProfileName}
          canDeleteProfiles={canDeleteProfiles}
          onRemove={name => {
            setDeleteError(null)
            setProfileToDelete(name)
          }}
        />
      </PageContent>
      <ConfirmMutationDialog
        open={Boolean(profileToDelete)}
        onOpenChange={open => !open && setProfileToDelete(null)}
        title='Remove profile?'
        description={`Permanently delete “${profileToDelete}” and its saved data.`}
        confirmLabel='Remove profile'
        pendingLabel='Removing…'
        error={deleteError}
        pending={deleting}
        onConfirm={() => void deleteProfile()}
      />
    </EditorPage>
  )
}

export const AppProfilesSection = ({
  profiles,
  activeProfileName = null,
  canDeleteProfiles = false,
  onRemove,
  loading = false
}: {
  profiles: AppDefinition['savedProfiles']
  activeProfileName?: string | null
  canDeleteProfiles?: boolean
  onRemove: (name: string) => void
  loading?: boolean
}) => (
  <Section
    surface='plain'
    className={editorSectionClassName}
    title='Profiles'
    description='Saved app data. The active profile cannot be removed.'
    headingSpacing='default'
    contentClassName='gap-3'
  >
    <Visible when={!loading && profiles.length === 0}>
      <p className='text-sm text-foreground-muted'>No saved persistent profiles are available yet.</p>
    </Visible>
    {(loading
      ? Array.from({ length: 3 }, (_, index) => ({ name: String(index), mode: 'persistent' as const }))
      : profiles
    ).map(profile => {
      const isActive = activeProfileName === profile.name
      const canRemove = !loading && canDeleteProfiles && !isActive

      return (
        <div
          key={profile.name}
          className='flex min-w-0 flex-wrap items-center gap-3 rounded-control bg-surface-band/30 p-3'
        >
          <span className='grid size-9 shrink-0 place-items-center rounded-control bg-surface-band text-foreground-muted'>
            <IconDatabase className='size-4' />
          </span>
          <div className='min-w-0 flex-1 basis-40'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='text-sm font-medium [overflow-wrap:anywhere]'>
                {loading ? (
                  <Skeleton
                    as='span'
                    className='my-0.5 block h-4 w-32'
                  />
                ) : (
                  profile.name
                )}
              </p>
              <Visible when={isActive}>
                <Badge variant='outline'>Active</Badge>
              </Visible>
            </div>
            <p className='text-xs text-foreground-muted'>
              Persistent runtime data volume for this application profile.
            </p>
          </div>
          <Button
            type='button'
            variant='danger'
            size='sm'
            disabled={!canRemove}
            onClick={() => onRemove(profile.name)}
          >
            <IconTrash className='size-4' />
            Remove
          </Button>
        </div>
      )
    })}
  </Section>
)
