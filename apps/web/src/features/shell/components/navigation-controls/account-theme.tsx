import { appThemeOptions } from '@/components/ui/theme-toggle'

export const accountThemeOptions = [
  ...appThemeOptions.filter(option => option.value === 'system'),
  ...appThemeOptions.filter(option => option.value !== 'system')
]

export const AccountThemeSwatch = ({ theme }: { theme: (typeof appThemeOptions)[number]['value'] }) => (
  <span
    aria-hidden='true'
    className='flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[calc(var(--shape-control)/3)] border border-foreground-muted/65'
  >
    {theme === 'system' ? (
      <>
        <span className='light flex-1 bg-background' />
        <span className='dark flex-1 bg-background' />
      </>
    ) : (
      <span className={`flex-1 bg-background ${theme}`} />
    )}
  </span>
)
