import 'server-only'
import { userAccountService } from './user-account-service'
import { userGroupService } from './user-group-service'
import { userPasswordService } from './user-password-service'
import { authenticate, getUserById, listGroups, listUsers } from './user-queries'

export type { PublicUser, UserEditorInput, UserGroup, UserRole } from './user-model'

export const userService = {
  authenticate,
  getUserById,
  listGroups,
  listUsers,
  ...userAccountService,
  ...userGroupService,
  ...userPasswordService
}
