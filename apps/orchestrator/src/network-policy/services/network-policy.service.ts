import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import type { NetworkPolicyTarget } from '../../android-apps/contracts/android-apps-runtime-inventory.port';
import {
  DOCKER_NETWORK_RUNTIME,
  type DockerNetworkRuntimePort,
} from '../../docker/contracts/docker-network-runtime.port';
import {
  DOCKER_SIDECAR,
  type DockerSidecarPort,
} from '../../docker/contracts/docker-sidecar.port';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../docker/contracts/docker-engine.port';
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

@Injectable()
export class NetworkPolicyService {
  private readonly logger = new Logger(NetworkPolicyService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_ENGINE)
    private readonly engine: DockerEnginePort,
    @Inject(DOCKER_NETWORK_RUNTIME)
    private readonly networks: DockerNetworkRuntimePort,
    @Inject(DOCKER_SIDECAR)
    private readonly sidecar: DockerSidecarPort,
    private readonly agent: FirewallAgentClientService,
    private readonly features: FeatureFlagsService,
  ) {}

  async apply(app: NetworkPolicyTarget): Promise<AppliedNetworkPolicy> {
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
      await this.remove(app);
      return {
        status: 'skipped',
        message: 'Network policy is disabled for this application.',
      };
    }

    const policy = await this.resolvePolicy(app);
    if (!policy) {
      return {
        status: 'skipped',
        message: 'Container network address is not available yet.',
      };
    }

    try {
      await this.agent.apply(app.id, policy.agentPolicy);
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

  async reconcile(apps: NetworkPolicyTarget[]) {
    if (!this.features.isEnabled('feature.firewall')) return;
    const policies = (
      await mapWithConcurrency(
        apps.filter((app) => app.containerId && app.networkPolicyEnabled),
        4,
        async (app) => {
          const policy = await this.resolvePolicy(app);
          return policy
            ? { applicationId: app.id, ...policy.agentPolicy }
            : null;
        },
      )
    ).filter((policy): policy is NonNullable<typeof policy> => Boolean(policy));
    await this.agent.reconcile(policies);
  }

  async remove(app: Pick<NetworkPolicyTarget, 'id'>) {
    if (!this.features.isEnabled('feature.firewall')) return;
    await this.agent.remove(app.id).catch((error) => {
      this.logger.warn(
        `Could not remove firewall policy for ${app.id}: ${
          error instanceof Error
            ? error.message
            : 'unknown firewall agent error'
        }`,
      );
    });
  }

  private async validatedContainerIp(app: NetworkPolicyTarget) {
    const inspect = await this.engine.read(
      () => this.engine.docker.getContainer(app.containerId!).inspect(),
      `Inspect runtime container ${app.containerId} for network policy`,
    );
    const labels = inspect.Config?.Labels ?? {};
    if (
      labels['com.rebroid.managed'] !== 'true' ||
      labels['com.rebroid.application-id'] !== app.id ||
      labels['com.rebroid.component'] !== 'runtime'
    ) {
      throw new Error('Managed container identity validation failed.');
    }
    return (
      inspect.NetworkSettings?.Networks?.[app.networkName]?.IPAddress || null
    );
  }

  private async resolvePolicy(app: NetworkPolicyTarget) {
    const containerIp = await this.validatedContainerIp(app);
    if (!containerIp || !app.containerId) {
      return null;
    }
    const destinations = await this.allowedDestinations(app);
    return {
      destinations,
      agentPolicy: {
        containerId: app.containerId,
        containerIp,
        enabled: true,
        allowCidrs: destinations.cidrs,
        generation: Date.now(),
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
