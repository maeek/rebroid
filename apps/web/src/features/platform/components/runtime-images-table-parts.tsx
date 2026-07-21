import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatUtcDate } from '@/lib/format'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import { RuntimeImageBadges } from './runtime-image-badges'
import { formatImageContainerCount, formatImageSize, getImageSecondaryLabel } from './runtime-images-section-model'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { ColumnDef } from '@tanstack/react-table'

const ImageNameCell = ({ image }: { image: PlatformImage }) => {
  const name = imageDisplayName(image)
  const secondary = getImageSecondaryLabel(image)

  return (
    <div className='flex min-w-[18rem] flex-col gap-1'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/runtime/images/${encodeURIComponent(image.id)}`}
            className='block truncate font-medium hover:text-primary'
          >
            {name}
          </Link>
        </TooltipTrigger>
        <TooltipContent className='max-w-sm break-all'>{name}</TooltipContent>
      </Tooltip>
      <div className='truncate text-xs text-foreground-muted'>{secondary || image.shortId}</div>
      <RuntimeImageBadges image={image} />
    </div>
  )
}

export const createImageColumns = (): ColumnDef<PlatformImage>[] => [
  {
    id: 'name',
    accessorFn: image => imageDisplayName(image),
    header: 'Image',
    size: 384,
    meta: {
      label: 'Image',
      skeleton: {
        kind: 'custom',
        render: () => (
          <div className='grid gap-1'>
            <Skeleton className='h-5 w-[78%]' />
            <Skeleton className='h-4 w-[42%] opacity-70' />
            <div className='flex h-5 gap-1'>
              <Skeleton className='h-5 w-16 rounded-full' />
              <Skeleton className='h-5 w-20 rounded-full' />
            </div>
          </div>
        )
      }
    },
    cell: ({ row }) => <ImageNameCell image={row.original} />
  },
  {
    id: 'sizeBytes',
    accessorFn: image => image.sizeBytes,
    header: 'Size',
    size: 144,
    meta: { label: 'Size', skeleton: { kind: 'text', width: 'w-20' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{formatImageSize(row.original.sizeBytes)}</span>
  },
  {
    id: 'createdAt',
    accessorFn: image => image.createdAt,
    header: 'Created',
    size: 144,
    meta: { label: 'Created', skeleton: { kind: 'text', width: 'w-24' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{formatUtcDate(row.original.createdAt)}</span>
  },
  {
    id: 'containers',
    accessorFn: image => image.containers,
    header: 'Containers',
    size: 128,
    meta: { label: 'Containers', skeleton: { kind: 'text', width: 'w-12' } },
    cell: ({ row }) => (
      <span className='text-sm text-foreground-muted'>{formatImageContainerCount(row.original.containers)}</span>
    )
  },
  {
    id: 'id',
    header: 'ID',
    size: 224,
    enableSorting: false,
    meta: { label: 'ID', skeleton: { kind: 'text', width: 'w-28' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{row.original.shortId}</span>
  }
]
