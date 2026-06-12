import { IconLoader2, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'

export const PlatformPageRefreshButton = ({
  isRefreshing,
  onRefresh,
  label = 'Refresh',
  disabled
}: {
  isRefreshing?: boolean
  onRefresh: () => void
  label?: string
  disabled?: boolean
}) => (
  <Button
    type='button'
    variant='outline'
    disabled={disabled || isRefreshing}
    onClick={onRefresh}
  >
    {isRefreshing ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
    {label}
  </Button>
)
