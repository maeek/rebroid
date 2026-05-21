export interface AppliedNetworkPolicy {
  status: 'applied' | 'skipped' | 'error';
  message: string;
}

export interface AllowedDestinations {
  cidrs: string[];
  customCidrs: string[];
  defaultCidrsCount: number;
  unresolvedDefaults: string[];
}

export interface ResolvedDefaultDestinations {
  cidrs: string[];
  unresolved: string[];
}
