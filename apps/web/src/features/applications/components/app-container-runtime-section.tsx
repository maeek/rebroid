import { useContext, type ReactNode } from 'react'
import { Disclosure, DisclosureChevron, DisclosureSummary } from '@/components/ui/disclosure'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
import { DetailFields } from '@/shared/ui/detail-fields'
import { verticalSettingClassName } from './app-form-utils'

type FieldMode = 'editable' | 'readonly'

type AppContainerRuntimeSectionProps = {
  title?: ReactNode
  contentClassName?: string
  containerImage: string
  onContainerImageChange?: (value: string) => void
  containerImageSlot?: ReactNode
  showContainerImage?: boolean
  containerImageMode?: FieldMode
  containerImageLabel?: string
  containerImageDescription?: string
  containerArgsModified?: boolean
  containerArgsValue?: string
  onContainerArgsChange?: (value: string) => void
  showContainerArgs?: boolean
  containerArgsMode?: FieldMode
  containerArgsLabel?: string
  containerArgsDescription?: string
  containerArgsPlaceholder?: string
  collapsibleArgs?: boolean
  children?: ReactNode
}

export const AppContainerRuntimeSection = ({
  title,
  contentClassName,
  containerImage,
  onContainerImageChange,
  containerImageSlot,
  showContainerImage = true,
  containerImageMode = 'editable',
  containerImageLabel = 'Image',
  containerImageDescription = 'Container image used to boot this managed app runtime.',
  containerArgsModified,
  containerArgsValue,
  onContainerArgsChange,
  showContainerArgs = true,
  containerArgsMode = 'editable',
  containerArgsLabel = 'Container arguments',
  containerArgsDescription = 'Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.',
  containerArgsPlaceholder,
  collapsibleArgs = false,
  children
}: AppContainerRuntimeSectionProps) => {
  const isContainerImageEditable = containerImageMode === 'editable'
  const isContainerArgsEditable = containerArgsMode === 'editable'
  const loading = useContext(FormLoadingContext)
  const argumentsField = (
    <FormField
      label={containerArgsLabel}
      modified={containerArgsModified}
      description={containerArgsDescription}
      layout='vertical'
      className={verticalSettingClassName}
    >
      <Textarea
        className='font-mono'
        rows={5}
        spellCheck={false}
        autoCapitalize='none'
        value={containerArgsValue ?? ''}
        placeholder={containerArgsPlaceholder}
        readOnly={!isContainerArgsEditable}
        onChange={event => (isContainerArgsEditable ? onContainerArgsChange?.(event.target.value) : undefined)}
      />
    </FormField>
  )

  return (
    <Section
      surface='plain'
      title={title}
      headingSpacing='default'
      contentClassName={contentClassName ?? 'gap-4'}
    >
      <Visible when={showContainerImage}>
        {!isContainerImageEditable && !containerImageSlot ? (
          <DetailFields
            loading={loading}
            compact
            fields={[
              {
                label: containerImageLabel,
                value: containerImage || null,
                copyValue: containerImage,
                code: true,
                fullWidth: true
              }
            ]}
          />
        ) : (
          <FormField
            label={containerImageLabel}
            description={containerImageDescription}
            layout='vertical'
            className={verticalSettingClassName}
          >
            {containerImageSlot ?? (
              <Input
                value={containerImage}
                readOnly={!isContainerImageEditable}
                onChange={event =>
                  isContainerImageEditable ? onContainerImageChange?.(event.target.value) : undefined
                }
              />
            )}
          </FormField>
        )}
      </Visible>

      <Visible when={children}>{children}</Visible>

      <Visible when={showContainerArgs}>
        {collapsibleArgs ? (
          <Disclosure className='group col-span-full min-w-0'>
            <DisclosureSummary className='touch-control flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground-muted hover:text-foreground'>
              <DisclosureChevron
                direction='right'
                className='size-4'
              />
              Container arguments
            </DisclosureSummary>
            <div className='pt-3'>{argumentsField}</div>
          </Disclosure>
        ) : (
          argumentsField
        )}
      </Visible>
    </Section>
  )
}
