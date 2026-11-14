import { normalizeIpv4Cidr } from '@rebroid/firewall-policy-core/policy'
import { TextField } from '../shared/action-fields'
import { stringInputValue } from '../shared/input-values'
import type { AutomationActionEditorProps } from '../automation-action-definition'

export function CidrActionFields({ input, patchInput }: Pick<AutomationActionEditorProps, 'input' | 'patchInput'>) {
  const cidr = stringInputValue(input, 'cidr')
  const normalized = normalizeIpv4Cidr(cidr)
  return (
    <TextField
      field='cidr'
      label='IPv4 address or range'
      placeholder='192.0.2.10 or 192.0.2.0/24…'
      className='font-mono'
      description={normalized && normalized !== cidr ? `Uses ${normalized}` : undefined}
      error={cidr && !normalized ? 'Enter an IPv4 address or a CIDR such as 192.0.2.0/24.' : undefined}
      value={cidr}
      onChange={value => patchInput({ cidr: value })}
    />
  )
}
