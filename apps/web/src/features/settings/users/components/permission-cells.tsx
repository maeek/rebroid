import { createContext, useContext, useId } from 'react'
import { IconCheck, IconMinus } from '@tabler/icons-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setPermissionDecision } from '../model/permission-access'
import type { EffectiveAccess, EffectivePermissionDecision } from '@/shared/permissions/effective-access'
import type { permissionDefinitions, PermissionMap } from '@/shared/permissions/permissions'
import type { CellContext } from '@tanstack/react-table'

type PermissionDefinition = (typeof permissionDefinitions)[number]

const PermissionSetting = ({
  permission,
  permissions,
  isUser,
  disabled,
  onChange
}: {
  permission: PermissionDefinition
  permissions: PermissionMap
  isUser: boolean
  disabled: boolean
  onChange: (permissions: PermissionMap) => void
}) => {
  const labelId = useId()
  const overridden = permissions[permission.id] !== undefined
  let setting = isUser ? 'inherit' : 'unset'
  if (overridden) setting = permissions[permission.id] ? 'allow' : 'deny'

  return (
    <div className='min-w-0'>
      <span
        id={`${labelId}-description`}
        className='sr-only'
      >
        {permission.description}
      </span>
      <Select
        value={setting}
        disabled={disabled}
        onValueChange={value => onChange(setPermissionDecision(permissions, permission.id, value))}
      >
        <SelectTrigger
          className='w-full'
          aria-label={`${isUser ? 'Override' : 'Set'} ${permission.name}`}
          aria-describedby={`${labelId}-description`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={isUser ? 'inherit' : 'unset'}>{isUser ? 'Inherit' : 'Not set'}</SelectItem>
          <SelectItem value='allow'>{isUser ? 'Allow' : 'Grant'}</SelectItem>
          <SelectItem value='deny'>Deny</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

const PermissionEffectiveAccess = ({ decision }: { decision?: EffectivePermissionDecision }) => {
  const enabled = decision?.allowed ?? false
  let source = 'Not granted by a group'
  if (decision?.source === 'group') source = `From ${decision.groupName}`
  if (decision?.source === 'override') source = 'User override'
  if (decision?.source === 'admin') source = 'Admin role'
  return (
    <div className='grid gap-1'>
      <span className='flex items-center gap-1.5 text-sm'>
        {enabled ? (
          <IconCheck
            aria-hidden='true'
            className='size-4 text-success'
          />
        ) : (
          <IconMinus
            aria-hidden='true'
            className='size-4 text-foreground-muted'
          />
        )}
        {enabled ? 'Granted' : 'Not granted'}
      </span>
      <span className='break-words text-xs text-foreground-muted'>{source}</span>
    </div>
  )
}

type PermissionEditorContextValue = {
  permissions: PermissionMap
  decisions: EffectiveAccess['decisions']
  isUser: boolean
  disabled: boolean
  onChange: (permissions: PermissionMap) => void
}
export const PermissionEditorContext = createContext<PermissionEditorContextValue | null>(null)
const usePermissionEditor = () => {
  const context = useContext(PermissionEditorContext)
  if (!context) throw new Error('Permission cells require an editor context.')
  return context
}
export const PermissionIdentityCell = ({ row }: CellContext<PermissionDefinition, unknown>) => (
  <div className='grid gap-1'>
    <span className='font-medium'>{row.original.name}</span>
    <span className='break-words text-xs leading-5 text-foreground-muted'>{row.original.description}</span>
  </div>
)
export const PermissionEffectiveCell = ({ row }: CellContext<PermissionDefinition, unknown>) => {
  const { decisions } = usePermissionEditor()
  return <PermissionEffectiveAccess decision={decisions[row.original.id]} />
}
export const PermissionSettingCell = ({ row }: CellContext<PermissionDefinition, unknown>) => {
  const { permissions, isUser, disabled, onChange } = usePermissionEditor()
  return (
    <PermissionSetting
      permission={row.original}
      permissions={permissions}
      isUser={isUser}
      disabled={disabled}
      onChange={onChange}
    />
  )
}
