export interface FirewallPolicy {
  applicationId: string;
  containerId: string;
  containerIp: string;
  enabled: boolean;
  allowCidrs: string[];
  generation: number;
}

export type FirewallAgentPolicy = Omit<FirewallPolicy, "applicationId">;
