import { Badge } from '@/components/ui/badge'

export const ProviderStatusBadge = ({ enabled }: { enabled: boolean }) =>
  enabled ? <Badge variant='status'>Enabled</Badge> : <Badge variant='secondary'>Disabled</Badge>
