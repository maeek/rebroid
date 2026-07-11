import 'server-only'
import { userAccountService } from './user-account-service'
import { userGroupService } from './user-group-service'
import { userMfaService } from './user-mfa-service'
import { userPasswordService } from './user-password-service'
import { authenticate, getUserById, listGroups, listUsers, verifyPrimaryCredentials } from './user-queries'

export type { PublicUser, UserEditorInput, UserGroup, UserRole } from './user-model'

export const userService = {
  authenticate,
  getUserById,
  listGroups,
  listUsers,
  verifyPrimaryCredentials,
  ...userAccountService,
  ...userGroupService,
  ...userMfaService,
  ...userPasswordService
}
