import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { AndroidApplication } from '../../android-apps/android-application.entity';
import { DockerNetworkRuntimeService } from '../../docker/networks/services/docker-network-runtime.service';
import { DockerSidecarService } from '../../docker/sidecar/services/docker-sidecar.service';
import { DockerEngineService } from '../../docker/docker-engine.service';
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

@Injectable()
export class NetworkPolicyService {
  private readonly logger = new Logger(NetworkPolicyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
    private readonly networks: DockerNetworkRuntimeService,
    private readonly sidecar: DockerSidecarService,
    private readonly agent: FirewallAgentClientService,
  ) {}

  async apply(app: AndroidApplication): Promise<AppliedNetworkPolicy> {
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

  async reconcile(apps: AndroidApplication[]) {
    const policies = (
      await Promise.all(
        apps
          .filter((app) => app.containerId && app.networkPolicyEnabled)
          .map(async (app) => {
            const policy = await this.resolvePolicy(app);
            return policy
              ? { applicationId: app.id, ...policy.agentPolicy }
              : null;
          }),
      )
    ).filter((policy): policy is NonNullable<typeof policy> => Boolean(policy));
    await this.agent.reconcile(policies);
  }

  async remove(app: Pick<AndroidApplication, 'id'>) {
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

  private async validatedContainerIp(app: AndroidApplication) {
    const inspect = await this.engine.docker
      .getContainer(app.containerId!)
      .inspect();
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

  private async resolvePolicy(app: AndroidApplication) {
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
    app: AndroidApplication,
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
    app: AndroidApplication,
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
    app: AndroidApplication,
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

  private async resolveApiCidrs(app: AndroidApplication) {
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
