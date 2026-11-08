'use client'

import { useState } from 'react'
import { IconDatabase, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { editorSectionClassName } from '@/components/ui/surface'
import { Visible } from '@/components/ui/visible'
import { AppNotFoundSplash } from '@/features/applications/components/app-not-found-splash'
import { AppResourceBreadcrumbs } from '@/features/applications/detail/app-resource-breadcrumbs'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { toast } from '@/hooks/use-toast'
import { deleteApplicationProfileAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { resolveAppIconUrl } from '@/shared/model/media/image-url'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { PageContent } from '@/shared/ui/page/page-layout'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppManageProfiles = ({ app, permissions }: { app?: AppDefinition; permissions: PermissionMap }) => {
  const [currentApp, setCurrentApp] = useState(app)
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const canDeleteProfiles = hasPermission(permissions, 'applications:delete')

  if (!currentApp) {
    return <AppNotFoundSplash />
  }

  const persistentProfiles = currentApp.savedProfiles.filter(profile => profile.mode === 'persistent')
  const activeProfileName = currentApp.profileMode === 'persistent' ? (currentApp.profileName ?? 'default') : null

  const deleteProfile = async () => {
    if (!profileToDelete || deleting) {
      return
    }

    setDeleting(true)
    try {
      const updated = mapAndroidApplicationToAppDefinition(
        await deleteApplicationProfileAction(currentApp.id, profileToDelete)
      )
      setCurrentApp(current => ({
        ...updated,
        icon: current?.icon ?? updated.icon,
        ownerDisplayName: current?.ownerDisplayName ?? updated.ownerDisplayName
      }))
      toast({
        title: 'Profile removed',
        description: `${profileToDelete} was deleted with its saved data.`,
        variant: 'success'
      })
      setProfileToDelete(null)
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not remove profile',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <EditorPage>
      <PageBackdrop
        imageSrc={currentApp.icon ? resolveAppIconUrl(currentApp.icon) : null}
        opacity={0.08}
      />
      <PageContent>
        <AppResourceBreadcrumbs
          appId={currentApp.id}
          appName={currentApp.name}
          view='profiles'
        />
        <AppViewerHeading app={currentApp} />
        <AppProfilesSection
          profiles={persistentProfiles}
          activeProfileName={activeProfileName}
          canDeleteProfiles={canDeleteProfiles}
          onRemove={setProfileToDelete}
        />
      </PageContent>
      <ConfirmMutationDialog
        open={Boolean(profileToDelete)}
        onOpenChange={open => !open && setProfileToDelete(null)}
        title='Remove profile?'
        description='Delete the saved profile and its persistent data. This cannot be undone.'
        summary={profileToDelete}
        confirmLabel='Remove profile'
        pendingLabel='Removing…'
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
