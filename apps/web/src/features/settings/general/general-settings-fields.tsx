'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appThemeOptions } from '@/components/ui/theme-toggle'
import { viewerPlacementOptions } from '@/shared/model/settings/viewer-placement'
import { useViewerPlacement } from '@/shared/model/settings/viewer-placement-context'
import { AccentColorPicker } from '@/shared/ui/settings/accent-color-picker'
import type { AccentColor } from '@/shared/model/theme/accent-color'

export const AppearanceSettings = ({
  accentColor,
  onAccentColorChange,
  loading = false
}: {
  accentColor: AccentColor
  onAccentColorChange: (color: AccentColor) => void
  loading?: boolean
}) => (
  <div
    id='appearance'
    className='scroll-mt-[calc(var(--console-top-inset)+1rem)]'
  >
    <Section
      surface='plain'
      title='Appearance'
    >
      <div className='grid gap-x-form-column gap-y-4 sm:grid-cols-2'>
        <ThemeField loading={loading} />
        <ViewerPlacementField loading={loading} />
      </div>
      <AccentColorPicker
        value={accentColor}
        loading={loading}
        onChange={onAccentColorChange}
      />
    </Section>
  </div>
)

const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

const ThemeField = ({ loading }: { loading: boolean }) => {
  const { theme, setTheme } = useTheme()
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)
  return (
    <FormField
      label='Theme'
      description='Applies immediately in this browser.'
      layout='vertical'
    >
      <Select
        value={hydrated ? (theme ?? '') : ''}
        onValueChange={setTheme}
        disabled={loading || !hydrated}
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='Select theme' />
        </SelectTrigger>
        <SelectContent>
          {appThemeOptions.map(({ value, label }) => (
            <SelectItem
              key={value}
              value={value}
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}

const ViewerPlacementField = ({ loading }: { loading: boolean }) => {
  const { placement, setPlacement } = useViewerPlacement()
  return (
    <FormField
      label='Viewer layout'
      description='Choose where the viewer appears on wide screens. On narrow screens it sits above the page content.'
      layout='vertical'
    >
      <Select
        value={placement}
        onValueChange={setPlacement}
        disabled={loading}
      >
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {viewerPlacementOptions.map(({ value, label }) => (
            <SelectItem
              key={value}
              value={value}
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}
