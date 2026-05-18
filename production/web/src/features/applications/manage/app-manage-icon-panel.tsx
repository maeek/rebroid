import { useRef, useState, type ChangeEvent } from 'react'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { AppIcon } from '@/features/applications/components/app-icon'
import { optimizeIconFile } from '@/features/applications/icons/icon-metadata'
import {
  apkSizeLabel,
  isFileWithinApkLimit,
  useOrchestratorUiSettings
} from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { toast } from '@/hooks/use-toast'
import { removeAppIconAction } from '@/server/app-icons/actions/remove-app-icon-action'
import { setAppIconAction } from '@/server/app-icons/actions/set-app-icon-action'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

const recentAppsStorageKey = 'sma_recent_apps'
const recentAppsUpdatedEvent = 'sma-recent-apps-updated'

type RecentApp = {
  id: string
  name: string
  icon?: string | null
  openedAt: number
}

type AppManageIconPanelProps = {
  appId: string
  appName: string
  icon: string | null
  initialSettings: OrchestratorUiSettings
  onIconChange: (icon: string | null, isDirty: boolean) => void
}

export const AppManageIconPanel = ({
  appId,
  appName,
  icon,
  initialSettings,
  onIconChange
}: AppManageIconPanelProps) => {
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const iconInputRef = useRef<HTMLInputElement>(null)
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })

  const syncSidebarRecentApp = (nextIcon: string | null) => {
    try {
      const raw = window.localStorage.getItem(recentAppsStorageKey)
      const currentApps = raw ? (JSON.parse(raw) as RecentApp[]) : []
      let didUpdate = false

      const nextApps = currentApps.map(app => {
        if (app.id !== appId) {
          return app
        }

        didUpdate = true
        return { ...app, name: appName, icon: nextIcon }
      })

      if (!didUpdate) {
        return
      }

      window.localStorage.setItem(recentAppsStorageKey, JSON.stringify(nextApps))
      window.dispatchEvent(new CustomEvent(recentAppsUpdatedEvent, { detail: nextApps }))
    } catch {
      // Keep the local UI responsive even if recent-app metadata cannot be updated.
    }
  }

  const handleIconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isFileWithinApkLimit(file, settings.maxApkUploadSizeMb)) {
      toast({
        title: 'File is too large',
        description: `The configured upload limit is ${apkSizeLabel(settings.maxApkUploadSizeMb)}.`,
        variant: 'destructive'
      })
      event.target.value = ''
      return
    }

    setIsUploadingIcon(true)
    try {
      const optimizedIcon = await optimizeIconFile(file)
      await setAppIconAction(appId, optimizedIcon)
      syncSidebarRecentApp(optimizedIcon)
      onIconChange(optimizedIcon, true)
      toast({ title: 'Icon updated' })
    } catch (error) {
      toast({
        title: 'Could not update icon',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingIcon(false)
      event.target.value = ''
    }
  }

  const handleClearIcon = async () => {
    if (iconInputRef.current) {
      iconInputRef.current.value = ''
    }

    setIsUploadingIcon(true)
    try {
      await removeAppIconAction(appId)
      syncSidebarRecentApp(null)
      onIconChange(null, true)
      toast({ title: 'Icon cleared' })
    } catch (error) {
      toast({
        title: 'Could not clear icon',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingIcon(false)
    }
  }

  return (
    <Section
      title='Icon'
      boxed
      contentClassName='gap-5'
    >
      <p className='text-xs leading-relaxed text-muted-foreground'>
        This icon is stored in the web app metadata for display.
      </p>
      <div className='flex w-full flex-col items-center gap-5'>
        <AppIcon
          appId={appId}
          appName={appName}
          icon={icon}
          className='shrink-0 size-56 text-4xl shadow-[0_18px_60px_rgba(0,0,0,0.24)] max-sm:size-48'
        />
        <input
          ref={iconInputRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={event => void handleIconUpload(event)}
        />
        <div className='flex w-full gap-2 max-sm:flex-col'>
          <Button
            type='button'
            className='flex-1'
            disabled={isUploadingIcon}
            onClick={() => iconInputRef.current?.click()}
          >
            <IconUpload className='size-4' />
            Upload icon
          </Button>
          <Button
            type='button'
            variant='secondary'
            className='flex-1'
            disabled={isUploadingIcon}
            onClick={() => void handleClearIcon()}
          >
            <IconX className='size-4' />
            Clear icon
          </Button>
        </div>
      </div>
    </Section>
  )
}
