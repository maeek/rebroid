import { Badge } from '@/components/ui/badge'

export const ActivityResourceTypeBadge = ({ resourceType }: { resourceType: string | null }) =>
  resourceType ? <Badge variant='neutral'>{resourceType}</Badge> : null
