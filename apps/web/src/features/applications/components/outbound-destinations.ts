import { allowsBroadInternetAccess, normalizeIpv4Cidr } from '@rebroid/firewall-policy-core/policy'

const ipv4Destination = /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/

export const parseOutboundDestinations = (text: string, canUseInternet: boolean) => {
  const destinations = new Set<string>()
  for (const [index, line] of text.split('\n').entries()) {
    for (const entry of line.split(/[\s,]+/).filter(Boolean)) {
      const cidr = ipv4Destination.test(entry) ? normalizeIpv4Cidr(entry) : null
      if (!cidr) {
        const label = entry.length > 40 ? `${entry.slice(0, 40)}…` : entry
        return { error: `Line ${index + 1} has an invalid IPv4 address or range (${label}).` }
      }
      destinations.add(cidr)
    }
  }

  const cidrs = [...destinations]
  if (!canUseInternet && allowsBroadInternetAccess(cidrs)) {
    return { error: 'These destinations require internet access permission. Enter narrower IPv4 ranges.' }
  }

  return { cidrs }
}
