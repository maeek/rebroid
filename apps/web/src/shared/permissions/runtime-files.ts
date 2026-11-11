import { hasPermission, type PermissionMap } from './permissions'

export const resolveRuntimeFileAccess = (permissions: PermissionMap) => {
  const canTransferFiles = hasPermission(permissions, 'applications:transfer-files')
  return {
    canTransferFiles,
    canManageFiles: canTransferFiles && hasPermission(permissions, 'applications:manage-files')
  }
}
