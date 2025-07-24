import { IconCopy } from '@tabler/icons-react'
import { Section } from '@/components/ui/section'
import { AppDefinition } from '../../(standard)/constants'

const AppInfoRow = ({
  label,
  value,
  copyValue
}: {
  label: string
  value: string | React.ReactNode
  copyValue?: string
}) => (
  <div className='flex justify-between text-secondary-foreground group py-2'>
    <div>{label}</div>
    <div className='text-foreground flex gap-2 items-center group'>
      {copyValue && (
        <IconCopy
          className='size-4 invisible group-focus-within:visible group-hover:visible cursor-pointer'
          onClick={() => {
            void navigator.clipboard.write([
              new ClipboardItem({
                'text/plain': copyValue
              })
            ])
          }}
        />
      )}
      {value}
    </div>
  </div>
)

export const AppInfo = ({ app, className }: { app?: AppDefinition; className?: string }) => {
  return (
    <Section
      className={className}
      title='Details'
    >
      <AppInfoRow
        label='ID'
        value={app?.id || 'Loading...'}
        copyValue={app?.id}
      />
      <AppInfoRow
        label='Last accessed'
        value={'Now'}
        copyValue={app?.lastAccessed?.toLocaleString()}
      />
      <AppInfoRow
        label='App version'
        value={<div className='flex justify-end flex-col items-end gap-2'>v{app?.version}</div>}
        copyValue={app?.version}
      />
      <AppInfoRow
        label='Container name'
        value={app?.containerName}
        copyValue={app?.containerName}
      />
    </Section>
  )
}
