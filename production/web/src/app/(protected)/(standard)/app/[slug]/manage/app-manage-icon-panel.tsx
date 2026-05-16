import { useRef, useState, type ChangeEvent } from 'react'
import { IconUpload, IconX } from '@tabler/icons-react'
import { AppIcon } from '@/app/(protected)/_components/apps/app-icon'
import { Setting } from '@/app/(protected)/_components/settings/setting'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { setAppIconAction } from '@/lib/app-icons/actions'
import { optimizeIconFile } from '@/lib/orchestrator/icon-metadata'
import { apkSizeLabel, isFileWithinApkLimit, useOrchestratorUiSettings } from '@/lib/orchestrator/settings'

type AppManageIconPanelProps = {
  appId: string
  appName: string
  icon: string | null
  onIconChange: (icon: string | null, isDirty: boolean) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppManageIconPanel = ({ appId, appName, icon, onIconChange }: AppManageIconPanelProps) => {
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const iconInputRef = useRef<HTMLInputElement>(null)
  const settings = useOrchestratorUiSettings()

  const handleIconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isFileWithinApkLimit(file, settings.maxApkUploadSizeMb)) {
      toast({
        title: 'File is too large',
        description: `The configured upload limit is ${apkSizeLabel(settings.maxApkUploadSizeMb)}.`
      })
      event.target.value = ''
      return
    }

    setIsUploadingIcon(true)
    try {
      const optimizedIcon = await optimizeIconFile(file)
      await setAppIconAction(appId, optimizedIcon)
      onIconChange(optimizedIcon, true)
      toast({ title: 'Icon updated' })
    } catch (error) {
      toast({ title: 'Could not update icon', description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsUploadingIcon(false)
      event.target.value = ''
    }
  }

  const handleClearIcon = () => {
    if (iconInputRef.current) {
      iconInputRef.current.value = ''
    }
    onIconChange(null, true)
  }

  return (
    <Setting
      label=''
      className={verticalSettingClassName}
      variant='vertical'
    >
      <div className='flex w-full flex-col items-center gap-6'>
        <AppIcon
          appId={appId}
          appName={appName}
          icon={icon}
          className='shrink-0 size-72 z-[-1] text-4xl'
        />
        <input
          ref={iconInputRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={event => void handleIconUpload(event)}
        />
        <div className='flex gap-1'>
          <Button
            type='button'
            disabled={isUploadingIcon}
            onClick={() => iconInputRef.current?.click()}
          >
            <IconUpload className='size-4' />
            Upload icon
          </Button>
          <Button
            type='button'
            variant='secondary'
            disabled={isUploadingIcon}
            onClick={handleClearIcon}
          >
            <IconX className='size-4' />
            Clear icon
          </Button>
        </div>
      </div>
    </Setting>
  )
}
