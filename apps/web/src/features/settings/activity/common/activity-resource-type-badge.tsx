import { Badge } from '@/components/ui/badge'

export const ActivityResourceTypeBadge = ({ resourceType }: { resourceType: string | null }) =>
  resourceType ? <Badge variant='secondary'>{resourceType}</Badge> : null
