import { useRef, useState, type ChangeEvent } from 'react'
import { IconUpload, IconX } from '@tabler/icons-react'
import { AppIcon } from '@/app/(protected)/_components/apps/app-icon'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
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

  const handleClearIcon = () => {
    if (iconInputRef.current) {
      iconInputRef.current.value = ''
    }
    onIconChange(null, true)
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
            onClick={handleClearIcon}
          >
            <IconX className='size-4' />
            Clear icon
          </Button>
        </div>
      </div>
    </Section>
  )
}
