export interface FirewallPolicy {
  applicationId: string;
  containerId: string;
  containerIp: string;
  enabled: boolean;
  allowCidrs: string[];
  generation: number;
  revision?: number;
  startup?: true;
}

export type FirewallAgentPolicy = Omit<FirewallPolicy, "applicationId">;
