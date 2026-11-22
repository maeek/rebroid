'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordApplicationAudit } from '@/server/audit/application-event'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { assertCanManageApplicationFiles } from '../../runtime-file-access'

export const createApplicationRuntimeDirectoryAction = async (id: string, parentPath: string, name: string) =>
  runSafeAction(
    async () => {
      const { app, user } = await assertCanManageApplicationFiles(id)
      const result = await orchestratorAppRuntimeClient.createRuntimeDirectory(id, { parentPath, name })
      recordApplicationAudit(
        user.ownerUserId,
        'application.file.directory.create',
        { id, name: app.name },
        { path: result.path, name: result.name, type: result.type }
      )
      return result
    },
    { fallbackMessage: 'Could not create the folder.', logLabel: 'createApplicationRuntimeDirectoryAction failed' }
  )

export const renameApplicationRuntimeFileAction = async (id: string, path: string, name: string) =>
  runSafeAction(
    async () => {
      const { app, user } = await assertCanManageApplicationFiles(id)
      const result = await orchestratorAppRuntimeClient.renameRuntimeFile(id, { path, name })
      recordApplicationAudit(
        user.ownerUserId,
        'application.file.rename',
        { id, name: app.name },
        { path, destinationPath: result.path, type: result.type }
      )
      return result
    },
    { fallbackMessage: 'Could not rename the item.', logLabel: 'renameApplicationRuntimeFileAction failed' }
  )

export const deleteApplicationRuntimeFileAction = async (id: string, path: string) =>
  runSafeAction(
    async () => {
      const { app, user } = await assertCanManageApplicationFiles(id)
      const result = await orchestratorAppRuntimeClient.deleteRuntimeFile(id, path)
      recordApplicationAudit(
        user.ownerUserId,
        'application.file.delete',
        { id, name: app.name },
        { path: result.path, type: result.type, recursive: result.type === 'directory' }
      )
      return result
    },
    { fallbackMessage: 'Could not delete the item.', logLabel: 'deleteApplicationRuntimeFileAction failed' }
  )
