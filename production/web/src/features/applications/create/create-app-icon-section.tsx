import { type ChangeEvent, useRef } from 'react'
import { IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/features/applications/components/app-icon'

type CreateAppIconSectionProps = {
  appName: string
  iconPreview: string | null
  autoExtractIcon: boolean
  hasExtractedIcon: boolean
  onIconChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClearIcon: () => void
  onAutoExtractIconChange: (checked: boolean) => void
}

export const CreateAppIconSection = ({
  appName,
  iconPreview,
  autoExtractIcon,
  hasExtractedIcon,
  onIconChange,
  onClearIcon,
  onAutoExtractIconChange
}: CreateAppIconSectionProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClearIcon = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }

    onClearIcon()
  }

  return (
    <Section
      title='Icon'
      boxed
      titleClassName='pb-1'
      contentClassName='gap-5'
    >
      <p className='text-xs leading-relaxed text-muted-foreground'>
        Optional app icon for the web UI. Square images work best and are optimized locally before upload.
      </p>
      <div className='flex w-full flex-col items-center gap-5'>
        <AppIcon
          appId='new'
          appName={appName || 'App'}
          icon={iconPreview}
          className='size-44 text-4xl shadow-[0_18px_60px_rgba(0,0,0,0.24)] max-sm:size-40'
        />
        <div className='flex w-full items-center justify-between gap-4 rounded-lg border border-border/70 bg-secondary/55 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'>
          <div className='flex min-w-0 flex-col'>
            <span className='text-sm font-medium'>Auto extract from APK</span>
            <span className='text-xs text-secondary-foreground'>
              {hasExtractedIcon
                ? 'A launcher icon was found during APK upload.'
                : 'Upload an APK to extract its launcher icon.'}
            </span>
          </div>
          <Switch
            checked={autoExtractIcon}
            disabled={!hasExtractedIcon}
            onCheckedChange={onAutoExtractIconChange}
          />
        </div>
        <div className='flex w-full gap-2 max-sm:flex-col'>
          <Input
            ref={inputRef}
            type='file'
            accept='image/*'
            onChange={event => onIconChange(event)}
          />
          <Visible when={iconPreview}>
            <Button
              type='button'
              variant='outline'
              className='shrink-0'
              onClick={handleClearIcon}
            >
              <IconX className='size-4' />
              Clear icon
            </Button>
          </Visible>
        </div>
      </div>
    </Section>
  )
}
