import type { PublicUser, UserEditorInput } from '@/shared/contracts/auth-user'

export type UserDraft = {
  username: string
  name: string
  password: string
  groupIds: string[]
  disabled: boolean
  avatarDataUrl: string | null
}

export const toUserDraft = (user: PublicUser): UserDraft => ({
  username: user.username,
  name: user.name,
  password: '',
  groupIds: user.groupIds,
  disabled: user.disabled,
  avatarDataUrl: user.avatarDataUrl
})

export const buildUserUpdateInput = (draft: UserDraft): UserEditorInput => ({
  username: draft.username,
  name: draft.name,
  password: draft.password || undefined,
  groupIds: draft.groupIds,
  disabled: draft.disabled,
  avatarDataUrl: draft.avatarDataUrl
})
