'use client'

import { useState } from 'react'
import { IconDatabase, IconLoader2, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppNotFoundSplash } from '@/features/applications/components/app-not-found-splash'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { toast } from '@/hooks/use-toast'
import { deleteApplicationProfileAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { resolveAppIconUrl } from '@/shared/model/media/image-url'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { PageContent, StandardPageSplit } from '@/shared/ui/page/page-layout'
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
    if (!profileToDelete) {
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
    <StandardPageSplit>
      <PageBackdrop
        imageSrc={currentApp.icon ? resolveAppIconUrl(currentApp.icon) : null}
        opacity={0.08}
      />
      <PageContent>
        <PageBreadcrumbs
          items={[
            { label: 'Apps', href: '/apps' },
            { label: currentApp.name, href: `/app/${currentApp.id}` },
            { label: 'Manage', href: `/app/${currentApp.id}/manage` },
            { label: 'Profiles' }
          ]}
        />
        <AppViewerHeading app={currentApp} />
        <Section
          surface='plain'
          title='Profiles'
          headingSpacing='default'
          contentClassName='gap-3'
        >
          <Visible when={persistentProfiles.length === 0}>
            <p className='text-sm text-foreground-muted'>No saved persistent profiles are available yet.</p>
          </Visible>
          {persistentProfiles.map(profile => {
            const isActive = activeProfileName === profile.name
            const canRemove = canDeleteProfiles && !isActive

            return (
              <div
                key={profile.name}
                className='flex min-w-0 items-center gap-3 rounded-control border border-surface-border/70 bg-surface-panel/45 p-3'
              >
                <span className='grid size-9 shrink-0 place-items-center rounded-control bg-surface-band text-foreground-muted'>
                  <IconDatabase className='size-4' />
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='truncate text-sm font-medium'>{profile.name}</p>
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
                  onClick={() => setProfileToDelete(profile.name)}
                >
                  <IconTrash className='size-4' />
                  Remove
                </Button>
              </div>
            )
          })}
        </Section>
      </PageContent>
      <Dialog
        open={Boolean(profileToDelete)}
        onOpenChange={open => !open && setProfileToDelete(null)}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Remove profile</DialogTitle>
            <DialogDescription>
              Delete the saved profile and its persistent runtime data volume. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='secondary'
              disabled={deleting}
              onClick={() => setProfileToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              variant='danger'
              disabled={deleting}
              onClick={() => void deleteProfile()}
            >
              <Visible when={deleting}>
                <IconLoader2 className='size-4 animate-spin' />
              </Visible>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StandardPageSplit>
  )
}
