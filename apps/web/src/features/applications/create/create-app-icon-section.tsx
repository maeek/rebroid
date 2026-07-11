import { type ChangeEvent, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'

type AppFormIconSectionProps = {
  appId?: string
  appName: string
  iconPreview: string | null
  autoExtractIcon: boolean
  hasExtractedIcon: boolean
  disabled?: boolean
  surface?: 'plain' | 'band' | 'panel'
  showDescription?: boolean
  showAutoExtract?: boolean
  onIconChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClearIcon: () => void
  onAutoExtractIconChange: (checked: boolean) => void
}

export const AppFormIconSection = ({
  appId = 'new',
  appName,
  iconPreview,
  autoExtractIcon,
  hasExtractedIcon,
  disabled = false,
  surface = 'plain',
  showDescription = true,
  showAutoExtract = true,
  onIconChange,
  onClearIcon,
  onAutoExtractIconChange
}: AppFormIconSectionProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClearIcon = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }

    onClearIcon()
  }

  return (
    <Section
      surface={surface}
      title={showDescription ? 'Icon' : undefined}
      titleClassName='pb-1'
      contentClassName='gap-5'
    >
      <Visible when={showDescription}>
        <p className='text-xs leading-relaxed text-foreground-muted'>
          Optional app icon for the web UI. Square images work best and are optimized locally before upload.
        </p>
      </Visible>
      <div className='flex w-full flex-col items-center gap-5'>
        <AppIcon
          appId={appId}
          appName={appName || 'App'}
          icon={iconPreview}
          className='size-44 text-4xl shadow-[0_18px_60px_rgba(0,0,0,0.24)] max-sm:size-36'
        />

        <div className='flex w-full gap-2 max-sm:flex-col'>
          <Input
            ref={inputRef}
            type='file'
            accept='image/*'
            disabled={disabled}
            onChange={event => onIconChange(event)}
          />
          <Visible when={iconPreview}>
            <Button
              type='button'
              variant='ghost'
              className='shrink-0'
              disabled={disabled}
              onClick={handleClearIcon}
            >
              Clear icon
            </Button>
          </Visible>
        </div>
        <Visible when={showAutoExtract}>
          <div className='flex w-full items-center justify-between gap-4'>
            <div className='flex min-w-0 flex-col'>
              <span className='text-sm font-medium'>Auto extract from APK</span>
              <span className='text-xs text-foreground-muted'>
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
        </Visible>
      </div>
    </Section>
  )
}
