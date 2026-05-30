import {
  AndroidApplication,
  AndroidNetworkPolicyResult,
} from '../../android-application.entity';

export const deriveNetworkPolicyResult = (
  app: AndroidApplication,
): AndroidNetworkPolicyResult | null => {
  const status = app.networkPolicyStatus as
    | 'applied'
    | 'skipped'
    | 'error'
    | null;
  const message = app.networkPolicyMessage?.trim();

  if (!status || !message) {
    return null;
  }

  if (status === 'applied') {
    return {
      status,
      code: 'applied',
      message,
      hint: 'Outbound access is restricted to the API, the display sidecar, and any CIDR ranges in the allowlist.',
    };
  }

  if (status === 'error') {
    const code = message.toLowerCase().includes('unavailable')
      ? 'agent_unavailable'
      : message.toLowerCase().includes('unsupported') ||
          message.toLowerCase().includes('no supported')
        ? 'unsupported_host'
        : 'apply_failed';
    return {
      status,
      code,
      message,
      hint: 'Check firewall agent health and host firewall configuration, then apply the policy again.',
    };
  }

  if (status !== 'skipped') {
    return {
      status,
      code: 'unknown',
      message,
      hint: null,
    };
  }

  if (!app.containerId) {
    return {
      status,
      code: 'container_not_created',
      message,
      hint: 'Start the app first so the orchestrator can create the managed container and attach network rules to it.',
    };
  }

  if (!app.networkPolicyEnabled) {
    return {
      status,
      code: 'policy_disabled',
      message,
      hint: 'Enable the network policy for this app to restrict outbound traffic again.',
    };
  }

  return {
    status,
    code: 'container_ip_unavailable',
    message,
    hint: 'The container is not fully ready on its network yet. Try applying the policy again after startup finishes.',
  };
};
