import { type ChangeEvent, useRef } from 'react'
import { IconX } from '@tabler/icons-react'
import { AppIcon } from '@/app/(protected)/_components/apps/app-icon'
import { Setting } from '@/app/(protected)/_components/settings/setting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type CreateAppIconSectionProps = {
  appName: string
  iconPreview: string | null
  onIconChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClearIcon: () => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const CreateAppIconSection = ({
  appName,
  iconPreview,
  onIconChange,
  onClearIcon
}: CreateAppIconSectionProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClearIcon = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }

    onClearIcon()
  }

  return (
    <Setting
      label='Icon'
      description='Optional app icon for the web UI. Square images work best and are optimized locally before upload.'
      variant='vertical'
      className={verticalSettingClassName}
    >
      <div className='flex flex-col gap-4 items-center w-full'>
        <AppIcon
          appId='new'
          appName={appName || 'App'}
          icon={iconPreview}
          className='size-56 text-4xl'
        />
        <div className='flex gap-1'>
          <Input
            ref={inputRef}
            type='file'
            accept='image/*'
            onChange={event => onIconChange(event)}
          />
          {iconPreview && (
            <Button
              type='button'
              variant='outline'
              onClick={handleClearIcon}
            >
              <IconX className='size-4' />
              Clear icon
            </Button>
          )}
        </div>
      </div>
    </Setting>
  )
}
