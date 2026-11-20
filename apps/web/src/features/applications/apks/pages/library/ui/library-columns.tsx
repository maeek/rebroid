import { StatusBadge } from '@/components/ui/status-badge'
import { formatBytes } from '@/lib/format-bytes'
import { cn } from '@/lib/utils'
import { entryLabel } from '../model/library-grid'
import type { ApkLibraryEntry } from '@/shared/contracts/apk-library'
import type { ColumnDef } from '@tanstack/react-table'
import styles from '@/shared/ui/data-grid/data-grid-table.module.css'

export const apkLibraryColumns: ColumnDef<ApkLibraryEntry>[] = [
  {
    id: 'apk',
    header: 'APK',
    size: 360,
    enableHiding: false,
    meta: { compactSlot: 'title', label: 'APK', skeleton: { kind: 'stacked' } },
    cell: ({ row: { original: entry } }) => (
      <div className={`grid min-w-0 gap-1 ${styles.settingsStack}`}>
        <span
          translate='no'
          className='truncate font-medium text-primary'
        >
          {entryLabel(entry)}
        </span>
        {entry.packageName && entry.sha256 ? (
          <span
            translate='no'
            className='truncate font-mono text-xs text-foreground-muted'
          >
            {entry.packageName}
          </span>
        ) : null}
      </div>
    )
  },
  {
    id: 'status',
    header: 'Status',
    size: 112,
    meta: { compactSlot: 'status', label: 'Status', skeleton: { kind: 'badge' } },
    cell: ({ row }) =>
      row.original.rules.length ? (
        <StatusBadge tone='danger'>Blocked</StatusBadge>
      ) : (
        <StatusBadge tone='success'>Ready</StatusBadge>
      )
  },
  {
    id: 'uploads',
    header: 'Uploads',
    size: 96,
    meta: { label: 'Uploads' },
    cell: ({ row }) => <span className='tabular-nums'>{row.original.uploads}</span>
  },
  {
    id: 'usage',
    header: 'Used by',
    size: 120,
    meta: { compactSlot: 'details', label: 'Used by' },
    cell: ({ row: { original: entry } }) => {
      const usage = entry.apps.length ? `${entry.apps.length} ${entry.apps.length === 1 ? 'app' : 'apps'}` : 'Unused'
      return (
        <>
          <span className={styles.settingsWideOnly}>{entry.sizeBytes === null ? '—' : usage}</span>
          <span className={cn(styles.settingsOnly, 'text-xs text-foreground-muted tabular-nums')}>
            {entry.sizeBytes === null
              ? 'File removed'
              : `${formatBytes(entry.sizeBytes)} · ${entry.apps.length ? 'Used by ' : ''}${usage}`}
          </span>
        </>
      )
    }
  },
  {
    id: 'size',
    header: 'On disk',
    size: 144,
    meta: { label: 'On disk' },
    cell: ({ row: { original: entry } }) => (
      <span className='whitespace-nowrap tabular-nums'>
        {entry.sizeBytes === null ? 'File removed' : formatBytes(entry.sizeBytes)}
      </span>
    )
  }
]
