'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { assertCanManageApplicationFiles, assertCanTransferApplicationFiles } from '../../runtime-file-access'

export const downloadApplicationRuntimeFileAction = async (id: string, path: string) =>
  runSafeAction(
    async () => {
      const { app, user } = await assertCanTransferApplicationFiles(id)
      const result = await orchestratorAppRuntimeClient.downloadRuntimeFile(id, path)
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.file.download',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: app.name,
        details: { path, name: result.name, type: 'file' }
      })
      return result
    },
    { fallbackMessage: 'Could not download the file.', logLabel: 'downloadApplicationRuntimeFileAction failed' }
  )

export const createApplicationRuntimeDirectoryAction = async (id: string, parentPath: string, name: string) =>
  runSafeAction(
    async () => {
      const { app, user } = await assertCanManageApplicationFiles(id)
      const result = await orchestratorAppRuntimeClient.createRuntimeDirectory(id, { parentPath, name })
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.file.directory.create',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: app.name,
        details: { path: result.path, name: result.name, type: result.type }
      })
      return result
    },
    { fallbackMessage: 'Could not create the folder.', logLabel: 'createApplicationRuntimeDirectoryAction failed' }
  )

export const renameApplicationRuntimeFileAction = async (id: string, path: string, name: string) =>
  runSafeAction(
    async () => {
      const { app, user } = await assertCanManageApplicationFiles(id)
      const result = await orchestratorAppRuntimeClient.renameRuntimeFile(id, { path, name })
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.file.rename',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: app.name,
        details: { path, destinationPath: result.path, type: result.type }
      })
      return result
    },
    { fallbackMessage: 'Could not rename the item.', logLabel: 'renameApplicationRuntimeFileAction failed' }
  )

export const deleteApplicationRuntimeFileAction = async (id: string, path: string) =>
  runSafeAction(
    async () => {
      const { app, user } = await assertCanManageApplicationFiles(id)
      const result = await orchestratorAppRuntimeClient.deleteRuntimeFile(id, path)
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.file.delete',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: app.name,
        details: { path: result.path, type: result.type, recursive: result.type === 'directory' }
      })
      return result
    },
    { fallbackMessage: 'Could not delete the item.', logLabel: 'deleteApplicationRuntimeFileAction failed' }
  )
