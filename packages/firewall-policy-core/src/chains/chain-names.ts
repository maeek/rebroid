export const firewallChainName = (applicationId: string) =>
  `RB_APP_${applicationId.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
