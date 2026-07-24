'use client'

import { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconChevronRight, IconFolder, IconFolderOpen } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { getBff } from '@/lib/http/bff'
import { cn } from '@/lib/utils'
import { runtimeFileLocations, runtimeFilesRootPath } from './downloads-tools-section-model'
import { runtimeFilesQueryKey, runtimeFilesUrl } from './use-runtime-file-browser'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

const RuntimeFolderTreeNode = ({
  appId,
  currentPath,
  depth,
  label,
  onNavigate,
  onPrefetch,
  path
}: {
  appId: string
  currentPath: string
  depth: number
  label: string
  onNavigate: (path: string) => void
  onPrefetch: (path: string) => void
  path: string
}) => {
  const [expanded, setExpanded] = useState(path === runtimeFilesRootPath)
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const query = useQuery<ApplicationRuntimeFile[]>({
    queryKey: runtimeFilesQueryKey(appId, path),
    queryFn: ({ signal }) => getBff(runtimeFilesUrl(appId, path), signal),
    enabled: expanded,
    staleTime: 10_000
  })
  const children = (query.data ?? []).filter(entry => entry.type === 'directory')
  const active = currentPath === path

  const schedulePrefetch = () => {
    if (intentTimerRef.current) clearTimeout(intentTimerRef.current)
    intentTimerRef.current = setTimeout(() => onPrefetch(path), 150)
  }
  const cancelPrefetch = () => {
    if (intentTimerRef.current) clearTimeout(intentTimerRef.current)
  }

  useEffect(() => cancelPrefetch, [])

  return (
    <div>
      <div
        className={cn('flex min-h-11 items-center rounded-control pr-1', active && 'bg-accent text-accent-foreground')}
        style={{ paddingLeft: `${Math.min(depth, 6) * 12}px` }}
      >
        <Button
          type='button'
          size='icon-sm'
          variant='bare'
          className='size-11 lg:size-8'
          onClick={() => setExpanded(value => !value)}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          aria-expanded={expanded}
        >
          {expanded ? <IconChevronDown className='size-4' /> : <IconChevronRight className='size-4' />}
        </Button>
        <Button
          type='button'
          size='sm'
          variant='bare'
          className='min-w-0 flex-1 justify-start gap-2 px-1 text-left'
          onMouseEnter={schedulePrefetch}
          onMouseLeave={cancelPrefetch}
          onFocus={schedulePrefetch}
          onBlur={cancelPrefetch}
          onClick={() => onNavigate(path)}
        >
          {expanded ? <IconFolderOpen className='size-4 text-primary' /> : <IconFolder className='size-4' />}
          <span className='truncate'>{label}</span>
        </Button>
      </div>
      {expanded ? (
        <div role='group'>
          {children.map(child => (
            <RuntimeFolderTreeNode
              key={child.path}
              appId={appId}
              currentPath={currentPath}
              depth={depth + 1}
              label={child.name}
              path={child.path}
              onNavigate={onNavigate}
              onPrefetch={onPrefetch}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

const RuntimeLocationButton = ({
  active,
  label,
  onNavigate,
  onPrefetch,
  path
}: {
  active: boolean
  label: string
  onNavigate: (path: string) => void
  onPrefetch: (path: string) => void
  path: string
}) => {
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const schedulePrefetch = () => {
    if (intentTimerRef.current) clearTimeout(intentTimerRef.current)
    intentTimerRef.current = setTimeout(() => onPrefetch(path), 150)
  }
  const cancelPrefetch = () => {
    if (intentTimerRef.current) clearTimeout(intentTimerRef.current)
  }
  useEffect(() => cancelPrefetch, [])

  return (
    <Button
      type='button'
      size='sm'
      variant={active ? 'secondary' : 'bare'}
      className='min-h-11 w-full justify-start gap-2 px-2 lg:min-h-9'
      onMouseEnter={schedulePrefetch}
      onMouseLeave={cancelPrefetch}
      onFocus={schedulePrefetch}
      onBlur={cancelPrefetch}
      onClick={() => onNavigate(path)}
    >
      <IconFolder className='size-4' />
      {label}
    </Button>
  )
}

export const RuntimeFileLocations = ({
  appId,
  currentPath,
  onNavigate,
  onPrefetch
}: {
  appId: string
  currentPath: string
  onNavigate: (path: string) => void
  onPrefetch: (path: string) => void
}) => (
  <div className='grid gap-4'>
    <div className='grid gap-1'>
      <h3 className='px-2 text-xs font-medium text-foreground-muted'>Locations</h3>
      {runtimeFileLocations.map(location => (
        <RuntimeLocationButton
          key={location.path}
          active={currentPath === location.path}
          label={location.label}
          path={location.path}
          onNavigate={onNavigate}
          onPrefetch={onPrefetch}
        />
      ))}
    </div>
    <div className='border-t border-surface-border/60 pt-3'>
      <h3 className='mb-1 px-2 text-xs font-medium text-foreground-muted'>Folder tree</h3>
      <RuntimeFolderTreeNode
        appId={appId}
        currentPath={currentPath}
        depth={0}
        label='Data'
        path={runtimeFilesRootPath}
        onNavigate={onNavigate}
        onPrefetch={onPrefetch}
      />
    </div>
  </div>
)
