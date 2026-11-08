import { type ChangeEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EditorFormContext } from '@/components/ui/editor-form-context'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'

type AppFormIconSectionProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  appId?: string
  appName: string
  iconPreview: string | null
  autoExtractIcon: boolean
  hasExtractedIcon: boolean
  disabled?: boolean
  pending?: boolean
  surface?: 'plain' | 'band' | 'panel'
  showDescription?: boolean
  showAutoExtract?: boolean
  onIconChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClearIcon: () => void
  onAutoExtractIconChange: (checked: boolean) => void
}

export const AppFormIconSection = ({
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  appId = 'new',
  appName,
  iconPreview,
  autoExtractIcon,
  hasExtractedIcon,
  disabled = false,
  pending = false,
  surface = 'plain',
  showDescription = true,
  showAutoExtract = true,
  onIconChange,
  onClearIcon,
  onAutoExtractIconChange
}: AppFormIconSectionProps) => {
  const [uploadRevision, setUploadRevision] = useState(0)
  const handleClearIcon = () => {
    setUploadRevision(current => current + 1)
    onClearIcon()
  }

  return (
    <Section
      surface={surface}
      title={showDescription ? 'Icon' : undefined}
      headingSpacing='compact'
      contentClassName='gap-5'
    >
      <Visible when={showDescription}>
        <p className='text-xs leading-relaxed text-foreground-muted'>
          Optional app icon for the web UI. Square images work best and are optimized locally before upload.
        </p>
      </Visible>
      <div className='grid w-full grid-cols-[3rem_minmax(0,1fr)] items-center gap-4'>
        <AppIcon
          appId={appId}
          appName={appName || 'App'}
          icon={iconPreview}
          className='size-12 text-base'
        />
        <div className='grid min-w-0 justify-items-start gap-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <FileUploadField
              className='w-auto'
              id={id}
              aria-describedby={ariaDescribedBy}
              aria-invalid={ariaInvalid}
              key={uploadRevision}
              aria-label='App icon'
              accept='image/*'
              pending={pending}
              disabled={disabled}
              onChange={onIconChange}
              buttonLabel='Upload icon'
              emptyLabel='Optional'
            />
            <Visible when={iconPreview}>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={disabled}
                onClick={handleClearIcon}
              >
                Remove icon
              </Button>
            </Visible>
          </div>
          <Visible when={showAutoExtract}>
            <EditorFormContext.Provider value={false}>
              <FormField
                label='Use icon from APK'
                className='w-fit justify-start gap-3'
                layout='horizontal'
                description={hasExtractedIcon ? 'Launcher icon available.' : undefined}
              >
                <Switch
                  checked={autoExtractIcon}
                  disabled={!hasExtractedIcon || disabled}
                  onCheckedChange={onAutoExtractIconChange}
                />
              </FormField>
            </EditorFormContext.Provider>
          </Visible>
        </div>
      </div>
    </Section>
  )
}
