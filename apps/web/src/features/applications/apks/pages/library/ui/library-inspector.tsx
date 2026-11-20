'use client'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDialogPayload } from '@/hooks/use-dialog-payload'
import { formatBytes } from '@/lib/format-bytes'
import { DetailFields } from '@/shared/ui/detail-fields'
import { availableBlockScopes, entryLabel, scopeLabels } from '../model/library-grid'
import type { ApkLibraryAction, ApkLibraryEntry } from '@/shared/contracts/apk-library'

const playServicesLabels: Record<string, string> = {
  required: 'References in the manifest',
  likely: 'References in bytecode',
  not_detected: 'No references detected',
  unknown: 'Inconclusive'
}

const evidenceLabels: Record<string, string> = {
  manifest_gms_version: 'Google Play services version metadata',
  manifest_google_shared_library: 'Google shared library',
  manifest_fcm_receiver: 'Firebase messaging receiver',
  manifest_google_service_binding: 'Google service binding',
  dex_google_play_services: 'Google Play services classes',
  dex_play_core: 'Google Play Core classes',
  dex_play_integrity: 'Google Play Integrity classes',
  dex_firebase_messaging: 'Firebase messaging classes',
  analysis_failed: 'Inspection could not complete',
  dex_scan_limit_exceeded: 'Bytecode scan limit reached'
}

export const ApkLibraryInspector = ({
  entry,
  close,
  canBlock,
  canDelete,
  onAction
}: {
  entry: ApkLibraryEntry | null
  close: () => void
  canBlock: boolean
  canDelete: boolean
  onAction: (action: ApkLibraryAction, entries: ApkLibraryEntry[]) => void
}) => {
  const { payload, onOpenChangeComplete } = useDialogPayload(entry)
  const displayed = payload ?? entry
  const showBlock = canBlock && displayed && availableBlockScopes([displayed], 'block').length > 0
  const showUnblock = canBlock && Boolean(displayed?.rules.length)
  const showDelete = canDelete && displayed && displayed.sizeBytes !== null
  return (
    <Sheet
      open={Boolean(entry)}
      onOpenChange={open => {
        if (!open) close()
      }}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <SheetContent className='grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg'>
        {displayed ? (
          <>
            <SheetHeader className='px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 pr-16 text-left sm:px-6 sm:pr-16'>
              <SheetTitle
                translate='no'
                className='line-clamp-2 text-pretty [overflow-wrap:anywhere]'
              >
                {entryLabel(displayed)}
              </SheetTitle>
              <SheetDescription>
                {displayed.rules.length ? 'Blocked' : 'Ready'} ·{' '}
                {displayed.sizeBytes === null ? 'File removed' : formatBytes(displayed.sizeBytes)}
              </SheetDescription>
            </SheetHeader>
            <div className='scrollbar-thin grid content-start gap-5 overflow-y-auto transform-gpu overscroll-contain px-5 pb-5 sm:px-6'>
              <DetailFields
                title='File details'
                fields={[
                  ...(displayed.sizeBytes !== null
                    ? [
                        {
                          label: 'Used by',
                          value: displayed.apps.map(app => app.name).join(', ') || 'No apps',
                          fullWidth: true
                        }
                      ]
                    : []),
                  ...(displayed.sha256 ? [{ label: 'Filename', value: displayed.originalName, fullWidth: true }] : []),
                  ...(displayed.packageName
                    ? [{ label: 'Package name', value: displayed.packageName, code: true, fullWidth: true }]
                    : []),
                  ...(displayed.sha256
                    ? [
                        {
                          label: 'SHA-256',
                          value: displayed.sha256,
                          copyValue: displayed.sha256,
                          code: true,
                          fullWidth: true
                        }
                      ]
                    : []),
                  ...(displayed.uploads ? [{ label: 'Upload records', value: displayed.uploads }] : []),
                  ...(displayed.ownerUserIds.length
                    ? [{ label: 'Uploader account IDs', value: displayed.ownerUserIds.join(', '), fullWidth: true }]
                    : [])
                ]}
              />
              {displayed.googlePlayServices || displayed.inspectionEvidence.length ? (
                <DetailFields
                  title='APK inspection'
                  fields={[
                    {
                      label: 'Google Play services',
                      value: displayed.googlePlayServices ? playServicesLabels[displayed.googlePlayServices] : null,
                      fullWidth: true
                    },
                    ...(displayed.inspectionEvidence.length
                      ? [
                          {
                            label: 'Findings',
                            value: displayed.inspectionEvidence
                              .map(evidence => evidenceLabels[evidence] ?? evidence)
                              .join('\n'),
                            fullWidth: true
                          }
                        ]
                      : [])
                  ]}
                />
              ) : null}
              {displayed.rules.length ? (
                <DetailFields
                  title='Active blocks'
                  fields={displayed.rules.map(rule => ({
                    label: scopeLabels[rule.scope],
                    value: (
                      <>
                        <code
                          translate='no'
                          className='block'
                        >
                          {rule.value}
                        </code>
                        {rule.reason}
                      </>
                    ),
                    fullWidth: true
                  }))}
                />
              ) : null}
            </div>
            {showBlock || showUnblock || showDelete ? (
              <div className='flex flex-wrap gap-x-2 gap-y-1 border-t border-surface-border/50 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6'>
                {showBlock ? (
                  <Button
                    variant='danger-ghost'
                    onClick={() => onAction('block', [displayed])}
                  >
                    Block APK
                  </Button>
                ) : null}
                {showUnblock ? (
                  <Button
                    variant='ghost'
                    onClick={() => onAction('unblock', [displayed])}
                  >
                    Unblock APK
                  </Button>
                ) : null}
                {showDelete ? (
                  <Button
                    variant='danger-ghost'
                    disabled={displayed.apps.length > 0}
                    onClick={() => onAction('delete', [displayed])}
                  >
                    Delete file
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
