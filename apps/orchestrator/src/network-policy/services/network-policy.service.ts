import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FirewallAgentPolicy } from '@rebroid/firewall-policy-core/policy';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import type {
  NetworkPolicyTarget,
  RestrictedRuntimePolicyTarget,
} from '../../android-apps/contracts/android-apps-runtime-inventory.port';
import { getErrorMessage } from '../../common/error-message';
import {
  DOCKER_NETWORK_RUNTIME,
  type DockerNetworkRuntimePort,
} from '../../docker/contracts/docker-network-runtime.port';
import {
  DOCKER_SIDECAR,
  type DockerSidecarPort,
} from '../../docker/contracts/docker-sidecar.port';
import {
  AllowedDestinations,
  AppliedNetworkPolicy,
  ResolvedDefaultDestinations,
} from '../types/network-policy.types';
import {
  extractHostname,
  normalizeIpv4Cidr,
  parseAllowCidrs,
  uniqueStrings,
} from '../utils/network-policy.utils';
import { FirewallAgentClientService } from './firewall-agent-client.service';
import { mapWithConcurrency } from '../../common/map-with-concurrency';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { NetworkPolicyRuntimeService } from './network-policy-runtime.service';

type RuntimePolicyObservation =
  | { state: 'inactive' }
  | { state: 'uncertain'; app: RestrictedRuntimePolicyTarget }
  | {
      state: 'live';
      app: RestrictedRuntimePolicyTarget;
      policy: FirewallAgentPolicy | null;
    };

const POLICY_CONCURRENCY = 4;

@Injectable()
export class NetworkPolicyService {
  private readonly logger = new Logger(NetworkPolicyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly runtimes: NetworkPolicyRuntimeService,
    @Inject(DOCKER_NETWORK_RUNTIME)
    private readonly networks: DockerNetworkRuntimePort,
    @Inject(DOCKER_SIDECAR)
    private readonly sidecar: DockerSidecarPort,
    private readonly agent: FirewallAgentClientService,
    private readonly features: FeatureFlagsService,
  ) {}

  async apply(
    app: NetworkPolicyTarget,
    generation = Date.now(),
  ): Promise<AppliedNetworkPolicy> {
    if (!this.features.isEnabled('feature.firewall')) {
      return app.networkPolicyEnabled
        ? {
            status: 'error',
            message:
              'Restricted networking cannot be enforced while feature.firewall is disabled.',
          }
        : { status: 'skipped', message: 'Firewall enforcement is disabled.' };
    }
    if (!app.containerId) {
      return {
        status: 'skipped',
        message: 'Container has not been created yet.',
      };
    }
    if (!app.networkPolicyEnabled) {
      await this.remove(app, app.containerId, generation);
      return {
        status: 'skipped',
        message: 'Network policy is disabled for this application.',
      };
    }

    return this.applyRestrictedPolicy(app, generation);
  }

  refreshViewerPolicy(app: NetworkPolicyTarget) {
    this.features.assertEnabled('feature.firewall');
    return this.applyRestrictedPolicy(app, Date.now(), true);
  }

  private async applyRestrictedPolicy(
    app: NetworkPolicyTarget,
    generation: number,
    refresh = false,
  ): Promise<AppliedNetworkPolicy> {
    const policy = await this.resolvePolicy(app, generation);
    if (!policy) {
      return {
        status: 'skipped',
        message: 'Container network address is not available yet.',
      };
    }

    try {
      await this.applyAgentPolicy(app.id, policy.agentPolicy, refresh);
      return {
        status: 'applied',
        message: this.appliedMessage(policy.destinations),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Firewall agent request failed.';
      this.logger.error(
        `Could not apply firewall policy for ${app.id}: ${message}`,
      );
      return { status: 'error', message };
    }
  }

  async reconcile(apps: NetworkPolicyTarget[], startedAt: number) {
    if (!this.features.isEnabled('feature.firewall')) return;
    const targets = apps.filter(
      (app): app is RestrictedRuntimePolicyTarget =>
        Boolean(app.containerId) && app.networkPolicyEnabled,
    );
    const result = await this.reconcileRestrictedRuntimes(targets, startedAt);
    if (!result.complete) {
      throw new ServiceUnavailableException(
        'Firewall reconciliation is incomplete. Existing rules were retained for unverified runtimes.',
      );
    }
  }

  restoreAtStartup(apps: RestrictedRuntimePolicyTarget[], startedAt: number) {
    return this.reconcileRestrictedRuntimes(apps, startedAt);
  }

  private async reconcileRestrictedRuntimes(
    apps: RestrictedRuntimePolicyTarget[],
    startedAt: number,
  ): Promise<{
    complete: boolean;
    unverified: RestrictedRuntimePolicyTarget[];
  }> {
    if (!this.features.isEnabled('feature.firewall')) {
      return { complete: true, unverified: [] };
    }
    const observations = await mapWithConcurrency(
      apps,
      POLICY_CONCURRENCY,
      (app) => this.prepareRuntimePolicy(app, startedAt),
    );
    const live = observations.filter(
      (observation) => observation.state === 'live',
    );
    const ready = live.flatMap(({ app, policy }) =>
      policy ? [{ applicationId: app.id, ...policy }] : [],
    );

    if (
      observations.every(({ state }) => state !== 'uncertain') &&
      live.length === ready.length
    ) {
      try {
        const response = await this.agent.reconcile(ready, startedAt);
        if (response.status !== 'applied') {
          throw new Error(
            'The firewall agent did not acknowledge the reconciliation snapshot.',
          );
        }
        return { complete: true, unverified: [] };
      } catch (error) {
        this.logger.warn(
          `Could not apply the firewall snapshot: ${getErrorMessage(error)}`,
        );
      }
    }

    // An incomplete snapshot would remove rules for runtimes we could not verify.
    const unverified = await mapWithConcurrency(
      observations.filter((observation) => observation.state !== 'inactive'),
      POLICY_CONCURRENCY,
      async (observation) => {
        const { app } = observation;
        if (observation.state === 'uncertain' || !observation.policy)
          return app;
        try {
          await this.applyAgentPolicy(app.id, observation.policy);
          return null;
        } catch (error) {
          this.logger.warn(
            `Could not apply firewall policy for ${app.id}: ${getErrorMessage(error)}`,
          );
          return app;
        }
      },
    );
    return {
      complete: false,
      unverified: unverified.filter((app) => app !== null),
    };
  }

  private async prepareRuntimePolicy(
    app: RestrictedRuntimePolicyTarget,
    generation: number,
  ): Promise<RuntimePolicyObservation> {
    const runtime = await this.runtimes.observeStartupRuntime(app);
    if (runtime.state === 'uncertain') {
      this.logger.warn(
        `Could not verify runtime for firewall reconciliation (${app.id}): ${runtime.reason}`,
      );
      return { state: 'uncertain', app };
    }
    if (runtime.state === 'inactive') return runtime;

    if (runtime.address) {
      try {
        const { agentPolicy } = await this.policyForAddress(
          app,
          app.containerId,
          runtime.address,
          generation,
        );
        return { state: 'live', app, policy: agentPolicy };
      } catch (error) {
        this.logger.warn(
          `Could not resolve firewall policy for ${app.id}: ${getErrorMessage(error)}`,
        );
      }
    } else {
      this.logger.warn(
        `No runtime IPv4 address for firewall reconciliation (${app.id}).`,
      );
    }
    return { state: 'live', app, policy: null };
  }

  private async applyAgentPolicy(
    appId: string,
    policy: FirewallAgentPolicy,
    refresh = false,
  ) {
    const response = refresh
      ? await this.agent.refresh(appId, policy)
      : await this.agent.apply(appId, policy);
    if (response.status !== 'applied') {
      throw new Error(
        'The firewall agent did not acknowledge the application policy.',
      );
    }
  }

  async guardStartup(app: NetworkPolicyTarget) {
    this.features.assertEnabled('feature.firewall');
    const subnet = await this.networks.getManagedIpv4Subnet(
      app.id,
      app.networkName,
    );
    const token = randomUUID();
    const result = await this.agent.apply(`startup-${app.id}`, {
      containerId: token,
      containerIp: subnet,
      enabled: true,
      allowCidrs: [],
      generation: Date.now(),
      startup: true,
    });
    if (result.status !== 'applied') {
      throw new Error(
        'The firewall agent did not acknowledge the startup guard.',
      );
    }
    return token;
  }

  async releaseStartupGuard(appId: string, token: string) {
    const result = await this.agent.remove(`startup-${appId}`, token);
    if (result.status !== 'applied') {
      throw new Error('The startup firewall guard could not be released.');
    }
  }

  async removeStartupGuard(appId: string) {
    if (!this.features.isEnabled('feature.firewall')) return;
    await this.agent.remove(`startup-${appId}`).catch((error: unknown) => {
      this.logger.warn(
        `Could not clear startup firewall guard for ${appId}: ${String(error)}`,
      );
    });
  }

  async remove(
    app: Pick<NetworkPolicyTarget, 'id' | 'networkPolicyRevision'>,
    expectedContainerId?: string,
    generation?: number,
  ) {
    if (!this.features.isEnabled('feature.firewall')) return;
    await this.agent
      .remove(
        app.id,
        expectedContainerId,
        generation,
        app.networkPolicyRevision,
      )
      .catch((error) => {
        this.logger.warn(
          `Could not remove firewall policy for ${app.id}: ${
            error instanceof Error
              ? error.message
              : 'unknown firewall agent error'
          }`,
        );
      });
  }

  private async resolvePolicy(app: NetworkPolicyTarget, generation: number) {
    const containerIp = await this.runtimes.getContainerIp(app);
    if (!containerIp || !app.containerId) {
      return null;
    }
    return this.policyForAddress(app, app.containerId, containerIp, generation);
  }

  private async policyForAddress(
    app: NetworkPolicyTarget,
    containerId: string,
    containerIp: string,
    generation: number,
  ) {
    const destinations = await this.allowedDestinations(app);
    return {
      destinations,
      agentPolicy: {
        containerId,
        containerIp,
        enabled: true,
        allowCidrs: destinations.cidrs,
        generation,
        revision: app.networkPolicyRevision,
      },
    };
  }

  private async allowedDestinations(
    app: NetworkPolicyTarget,
  ): Promise<AllowedDestinations> {
    const customCidrs = parseAllowCidrs(app.networkPolicyAllowCidrs);
    const defaultDestinations = await this.resolveDefaultDestinations(app);
    const sidecarIp = await this.sidecar.getSidecarIp(app.networkName);
    const sidecarCidrs = sidecarIp ? [`${sidecarIp}/32`] : [];
    return {
      cidrs: uniqueStrings([
        ...defaultDestinations.cidrs,
        ...sidecarCidrs,
        ...customCidrs,
      ]),
      customCidrs,
      defaultCidrsCount: defaultDestinations.cidrs.length + sidecarCidrs.length,
      unresolvedDefaults: defaultDestinations.unresolved,
    };
  }

  private async resolveDefaultDestinations(
    app: NetworkPolicyTarget,
  ): Promise<ResolvedDefaultDestinations> {
    const destinations = this.config.get<string[]>(
      'app.networkPolicy.defaultAllowDestinations',
    ) ?? ['API_IP', 'GATEWAY_IP'];
    const resolved = await Promise.all(
      destinations.map((destination) =>
        this.resolveDefaultDestination(app, destination),
      ),
    );
    return {
      cidrs: uniqueStrings(resolved.flatMap((item) => item.cidrs)),
      unresolved: uniqueStrings(resolved.flatMap((item) => item.unresolved)),
    };
  }

  private async resolveDefaultDestination(
    app: NetworkPolicyTarget,
    destination: string,
  ): Promise<ResolvedDefaultDestinations> {
    const normalized = destination.trim();
    const token = normalized.toUpperCase();

    if (token === 'DEFAULT') {
      const [api, gateway] = await Promise.all([
        this.resolveDefaultDestination(app, 'API_IP'),
        this.resolveDefaultDestination(app, 'GATEWAY_IP'),
      ]);
      return {
        cidrs: uniqueStrings([...api.cidrs, ...gateway.cidrs]),
        unresolved: uniqueStrings([...api.unresolved, ...gateway.unresolved]),
      };
    }

    if (token === 'API_IP' || token === 'ORCHESTRATOR_IP') {
      const cidrs = await this.resolveApiCidrs(app);
      return cidrs.length
        ? { cidrs, unresolved: [] }
        : { cidrs: [], unresolved: [token] };
    }

    if (token === 'GATEWAY_IP') {
      const ip = await this.networks.getNetworkGateway(app.networkName);
      return ip
        ? { cidrs: [`${ip}/32`], unresolved: [] }
        : { cidrs: [], unresolved: [token] };
    }

    if (token === 'INTERNET') return { cidrs: ['0.0.0.0/0'], unresolved: [] };

    const cidr = normalizeIpv4Cidr(normalized);
    return cidr
      ? { cidrs: [cidr], unresolved: [] }
      : { cidrs: [], unresolved: [normalized] };
  }

  private async resolveApiCidrs(app: NetworkPolicyTarget) {
    const configured = (
      this.config.get<string[]>('app.networkPolicy.apiCidrs') ?? []
    )
      .map(normalizeIpv4Cidr)
      .filter((value): value is string => Boolean(value));
    const host = extractHostname(
      this.config.get<string>('app.networkPolicy.apiHost'),
    );
    let hostCidrs: string[] = [];
    if (host) {
      const direct = normalizeIpv4Cidr(host);
      if (direct) {
        hostCidrs = [direct];
      } else {
        try {
          hostCidrs = (await lookup(host, { all: true, family: 4 })).map(
            ({ address }) => `${address}/32`,
          );
        } catch (error) {
          this.logger.warn(
            `Could not resolve NETWORK_POLICY_API_HOST: ${error instanceof Error ? error.message : 'DNS error'}`,
          );
        }
      }
    }

    const orchestratorIp = await this.networks.getOrchestratorIp(
      app.networkName,
    );
    return uniqueStrings([
      ...configured,
      ...hostCidrs,
      ...(orchestratorIp ? [`${orchestratorIp}/32`] : []),
    ]);
  }

  private appliedMessage(destinations: AllowedDestinations) {
    const unresolved = destinations.unresolvedDefaults.length
      ? ` Unresolved defaults: ${destinations.unresolvedDefaults.join(', ')}.`
      : '';
    return `Applied outbound policy with ${destinations.defaultCidrsCount} default destination(s) and ${destinations.customCidrs.length} custom CIDR(s).${unresolved}`;
  }
}
