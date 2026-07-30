import type { ReactNode } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { Visible } from '@/components/ui/visible'
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
  containerArgsValue?: string
  onContainerArgsChange?: (value: string) => void
  showContainerArgs?: boolean
  containerArgsMode?: FieldMode
  containerArgsLabel?: string
  containerArgsDescription?: string
  containerArgsPlaceholder?: string
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
  containerArgsValue,
  onContainerArgsChange,
  showContainerArgs = true,
  containerArgsMode = 'editable',
  containerArgsLabel = 'Container arguments',
  containerArgsDescription = 'Optional Docker Cmd override. Use a long-running command for images that would otherwise exit immediately, for example sleep infinity.',
  containerArgsPlaceholder,
  children
}: AppContainerRuntimeSectionProps) => {
  const isContainerImageEditable = containerImageMode === 'editable'
  const isContainerArgsEditable = containerArgsMode === 'editable'

  return (
    <Section
      surface='plain'
      title={title}
      headingSpacing='default'
      contentClassName={contentClassName ?? 'gap-4'}
    >
      <Visible when={showContainerImage}>
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
              onChange={event => (isContainerImageEditable ? onContainerImageChange?.(event.target.value) : undefined)}
            />
          )}
        </FormField>
      </Visible>

      <Visible when={children}>{children}</Visible>

      <Visible when={showContainerArgs}>
        <FormField
          label={containerArgsLabel}
          description={containerArgsDescription}
          layout='vertical'
          className={verticalSettingClassName}
        >
          <Textarea
            value={containerArgsValue ?? ''}
            placeholder={containerArgsPlaceholder}
            readOnly={!isContainerArgsEditable}
            onChange={event => (isContainerArgsEditable ? onContainerArgsChange?.(event.target.value) : undefined)}
          />
        </FormField>
      </Visible>
    </Section>
  )
}
