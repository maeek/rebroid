'use client'

import { useState } from 'react'
import { IconLogout } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { EditorFormContext } from '@/components/ui/editor-form-context'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { revokeAccountSessionsAction } from '@/server/users/actions/revoke-account-sessions-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import type { AccountSession } from '@/shared/contracts/account-session'
import type { ColumnDef } from '@tanstack/react-table'

const sessionLabel = (session: AccountSession) => `${session.browser} on ${session.operatingSystem}`

const sessionColumns: ColumnDef<AccountSession>[] = [
  {
    id: 'browser',
    accessorFn: sessionLabel,
    header: 'Browser',
    size: 280,
    meta: { label: 'Browser' },
    cell: ({ row }) => (
      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <span className='font-medium'>{sessionLabel(row.original)}</span>
        {row.original.current ? <Badge>This session</Badge> : null}
      </div>
    )
  },
  {
    accessorKey: 'signedInAt',
    header: 'Signed in',
    size: 176,
    meta: { label: 'Signed in' },
    cell: ({ row }) => (
      <DateTimeValue
        value={row.original.signedInAt}
        compact
      />
    )
  },
  {
    accessorKey: 'lastActiveAt',
    header: 'Last active',
    size: 176,
    meta: { label: 'Last active' },
    cell: ({ row }) => (
      <DateTimeValue
        value={row.original.lastActiveAt}
        compact
      />
    )
  }
]

export const AccountSessionsSection = ({
  sessions = [],
  userId,
  loading = false
}: {
  sessions?: AccountSession[]
  userId?: string | null
  loading?: boolean
}) => {
  const router = useRouter()
  const [selection, setSelection] = useState<AccountSession | 'all' | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const isAdminView = userId !== undefined
  const bulkLabel = isAdminView ? 'Sign out all sessions' : 'Sign out other sessions'
  const bulkTarget = isAdminView ? 'All browsers signed in to this account' : 'Your other browsers'
  const selectedSession = selection === 'all' ? null : selection
  const query = search.trim().toLowerCase()
  const visibleSessions = sessions.filter(session => sessionLabel(session).toLowerCase().includes(query))

  const revoke = async () => {
    if (!selection || pending || loading) return
    setPending(true)
    setError(undefined)
    try {
      const count = unwrapActionResult(
        await revokeAccountSessionsAction({ userId: userId ?? undefined, sessionId: selectedSession?.id ?? null })
      )
      setSelection(null)
      router.refresh()
      if (count)
        toast({ title: count === 1 ? 'Session signed out' : `${count} sessions signed out`, variant: 'success' })
    } catch (failure) {
      setError(getDisplayErrorMessage(failure))
    } finally {
      setPending(false)
    }
  }

  return (
    <EditorFormContext.Provider value={false}>
      <Section
        surface='plain'
        title='Active sessions'
        headingSpacing='compact'
      >
        <DataGridWorkspace
          disabled={loading}
          search={searchDraft}
          appliedSearch={search}
          searchPlaceholder='Search sessions'
          onSearchChange={setSearchDraft}
          onSearch={setSearch}
          actions={
            <Button
              type='button'
              variant='danger-ghost'
              disabled={pending || !sessions.some(session => !session.current)}
              onClick={() => setSelection('all')}
            >
              {bulkLabel}
            </Button>
          }
        >
          <DataGrid
            columns={sessionColumns}
            data={visibleSessions}
            totalItems={visibleSessions.length}
            pageIndex={0}
            pageSize={Math.max(visibleSessions.length, 1)}
            getRowId={session => session.id}
            minWidth='36rem'
            loading={loading ? { rowCount: 1 } : false}
            emptyState={
              <DataGridEmptyState
                title='No active sessions'
                description='New sign-ins will appear here.'
              />
            }
            rowContextMenu={row => (
              <ContextMenuItem
                disabled={pending || row.original.current}
                onSelect={() => setSelection(row.original)}
              >
                <IconLogout className='size-4' />
                Sign out session
              </ContextMenuItem>
            )}
          />
        </DataGridWorkspace>
      </Section>
      <ConfirmMutationDialog
        open={selection !== null}
        title={
          selection === 'all'
            ? `${bulkLabel}?`
            : `Sign out ${selectedSession ? sessionLabel(selectedSession) : 'this session'}?`
        }
        description={
          selection === 'all'
            ? `${bulkTarget} will return to sign-in and their Android viewers will disconnect.`
            : 'This browser will return to sign-in and its Android viewers will disconnect.'
        }
        confirmLabel={selection === 'all' ? bulkLabel : 'Sign out session'}
        pendingLabel='Signing out…'
        pending={pending}
        error={error}
        onConfirm={() => void revoke()}
        onOpenChange={open => {
          if (!open) {
            setSelection(null)
            setError(undefined)
          }
        }}
      />
    </EditorFormContext.Provider>
  )
}
