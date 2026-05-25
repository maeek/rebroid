import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { promisify } from 'node:util';
import { AndroidApplication } from '../../android-apps/android-application.entity';
import {
  extractHostname,
  networkPolicyChainName,
  normalizeIpv4Cidr,
  parseAllowCidrs,
  uniqueStrings,
} from '../utils/network-policy.utils';
import { DockerNetworkRuntimeService } from '../../docker/networks/services/docker-network-runtime.service';
import { DockerSidecarService } from '../../docker/sidecar/services/docker-sidecar.service';
import {
  AllowedDestinations,
  AppliedNetworkPolicy,
  ResolvedDefaultDestinations,
} from '../types/network-policy.types';

const execFileAsync = promisify(execFile);

@Injectable()
export class NetworkPolicyService {
  private readonly logger = new Logger(NetworkPolicyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly networks: DockerNetworkRuntimeService,
    private readonly sidecar: DockerSidecarService,
  ) {}

  /**
   * Creates or refreshes the per-app iptables chain and DOCKER-USER jump.
   * Returns skipped until iptables, the container, and its IP are all available.
   */
  async apply(app: AndroidApplication): Promise<AppliedNetworkPolicy> {
    if (!this.config.getOrThrow<boolean>('app.docker.iptablesEnabled')) {
      return {
        status: 'skipped',
        message:
          'IPTables policy is disabled. Set IPTABLES_POLICY_ENABLED=true on the Linux host.',
      };
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

    const containerIp = await this.networks.getContainerIp(
      app.containerId,
      app.networkName,
    );
    if (!containerIp) {
      return {
        status: 'skipped',
        message: 'Container IP address is not available yet.',
      };
    }

    const destinations = await this.allowedDestinations(app);
    const chain = networkPolicyChainName(app.id);

    try {
      await this.run(['-N', chain], true);
      await this.run(['-F', chain]);

      for (const destination of destinations.cidrs) {
        await this.run(['-A', chain, '-d', destination, '-j', 'ACCEPT']);
      }

      await this.run(['-A', chain, '-j', 'REJECT']);
      await this.ensureDockerUserJump(containerIp, chain);

      return {
        status: 'applied',
        message: this.appliedMessage(containerIp, destinations),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown iptables error';
      this.logger.error(message);
      return { status: 'error', message };
    }
  }

  /**
   * Removes the app-specific iptables chain and jump rule when they exist.
   * Cleanup is best-effort so repeated calls remain safe.
   */
  async remove(
    app: Pick<AndroidApplication, 'id' | 'containerId' | 'networkName'>,
  ) {
    if (!this.config.get<boolean>('app.docker.iptablesEnabled')) {
      return;
    }

    const chain = networkPolicyChainName(app.id);
    if (app.containerId) {
      const containerIp = await this.networks
        .getContainerIp(app.containerId, app.networkName)
        .catch(() => null);
      if (containerIp) {
        await this.run(
          ['-D', 'DOCKER-USER', '-s', containerIp, '-j', chain],
          true,
        );
      }
    }
    await this.run(['-F', chain], true);
    await this.run(['-X', chain], true);
  }

  /**
   * Merges default, sidecar, and custom allowlist CIDRs into the final rule set.
   */
  private async allowedDestinations(
    app: AndroidApplication,
  ): Promise<AllowedDestinations> {
    const customCidrs = parseAllowCidrs(app.networkPolicyAllowCidrs);
    const defaultDestinations = await this.resolveDefaultDestinations(app);
    const sidecarCidrs = await this.resolveScrcpySidecarCidrs(app);
    const cidrs = uniqueStrings([
      ...defaultDestinations.cidrs,
      ...sidecarCidrs,
      ...customCidrs,
    ]);

    return {
      cidrs,
      customCidrs,
      defaultCidrsCount: defaultDestinations.cidrs.length + sidecarCidrs.length,
      unresolvedDefaults: defaultDestinations.unresolved,
    };
  }

  private async resolveScrcpySidecarCidrs(app: AndroidApplication) {
    const sidecarIp = await this.sidecar.getSidecarIp(app.networkName);
    return sidecarIp ? [`${sidecarIp}/32`] : [];
  }

  private async resolveDefaultDestinations(
    app: AndroidApplication,
  ): Promise<ResolvedDefaultDestinations> {
    const destinations = this.config.get<string[]>(
      'app.networkPolicy.defaultAllowDestinations',
    ) ?? ['API_IP', 'GATEWAY_IP'];
    const cidrs: string[] = [];
    const unresolved: string[] = [];

    for (const destination of destinations) {
      const resolved = await this.resolveDefaultDestination(app, destination);
      cidrs.push(...resolved.cidrs);
      unresolved.push(...resolved.unresolved);
    }

    return {
      cidrs: uniqueStrings(cidrs),
      unresolved: uniqueStrings(unresolved),
    };
  }

  /**
   * Expands built-in tokens like API_IP and GATEWAY_IP, or normalizes literal CIDRs.
   * Unknown tokens are reported back as unresolved instead of throwing.
   */
  private async resolveDefaultDestination(
    app: AndroidApplication,
    destination: string,
  ): Promise<ResolvedDefaultDestinations> {
    const normalized = destination.trim();
    const token = normalized.toUpperCase();

    if (token === 'DEFAULT') {
      const api = await this.resolveDefaultDestination(app, 'API_IP');
      const gateway = await this.resolveDefaultDestination(app, 'GATEWAY_IP');
      return {
        cidrs: uniqueStrings([...api.cidrs, ...gateway.cidrs]),
        unresolved: uniqueStrings([...api.unresolved, ...gateway.unresolved]),
      };
    }

    if (token === 'API_IP' || token === 'ORCHESTRATOR_IP') {
      const cidrs = await this.resolveApiCidrs(app);
      return cidrs.length > 0
        ? { cidrs, unresolved: [] }
        : { cidrs: [], unresolved: [token] };
    }

    if (token === 'GATEWAY_IP') {
      const gatewayIp = await this.networks.getNetworkGateway(app.networkName);
      return gatewayIp
        ? { cidrs: [`${gatewayIp}/32`], unresolved: [] }
        : { cidrs: [], unresolved: [token] };
    }

    if (token === 'INTERNET') {
      return { cidrs: ['0.0.0.0/0'], unresolved: [] };
    }

    const cidr = normalizeIpv4Cidr(normalized);
    return cidr
      ? { cidrs: [cidr], unresolved: [] }
      : { cidrs: [], unresolved: [normalized] };
  }

  /**
   * Resolves all orchestrator/API endpoints that must remain reachable under the policy.
   */
  private async resolveApiCidrs(app: AndroidApplication): Promise<string[]> {
    const configuredCidrs = (
      this.config.get<string[]>('app.networkPolicy.apiCidrs') ?? []
    )
      .map((value) => normalizeIpv4Cidr(value))
      .filter((value): value is string => Boolean(value));
    const apiHostCidrs = await this.resolveApiHostCidrs();
    const attachedOrchestratorIp = await this.networks.getOrchestratorIp(
      app.networkName,
    );
    const attachedOrchestratorCidr = attachedOrchestratorIp
      ? `${attachedOrchestratorIp}/32`
      : null;

    return uniqueStrings([
      ...configuredCidrs,
      ...apiHostCidrs,
      ...(attachedOrchestratorCidr ? [attachedOrchestratorCidr] : []),
    ]);
  }

  /**
   * Resolves NETWORK_POLICY_API_HOST to IPv4 /32 entries.
   * Hostnames that do not resolve are logged and ignored.
   */
  private async resolveApiHostCidrs(): Promise<string[]> {
    const apiHost = this.config.get<string>('app.networkPolicy.apiHost');
    const hostname = extractHostname(apiHost);
    if (!hostname) {
      return [];
    }

    const directCidr = normalizeIpv4Cidr(hostname);
    if (directCidr) {
      return [directCidr];
    }

    try {
      const addresses = await lookup(hostname, { all: true, family: 4 });
      return uniqueStrings(addresses.map((address) => `${address.address}/32`));
    } catch (error) {
      this.logger.warn(
        `Could not resolve NETWORK_POLICY_API_HOST "${hostname}": ${
          error instanceof Error ? error.message : 'unknown DNS error'
        }`,
      );
      return [];
    }
  }

  /**
   * Ensures DOCKER-USER forwards container traffic into the app-specific chain exactly once.
   */
  private async ensureDockerUserJump(containerIp: string, chain: string) {
    const rule = ['DOCKER-USER', '-s', containerIp, '-j', chain];
    const exists = await this.run(['-C', ...rule], true);
    if (!exists.ok) {
      await this.run(['-I', ...rule]);
    }
  }

  /**
   * Summarizes the applied policy, including unresolved defaults for operator visibility.
   */
  private appliedMessage(
    containerIp: string,
    destinations: AllowedDestinations,
  ) {
    const customCount = destinations.customCidrs.length;
    const defaultSummary =
      destinations.defaultCidrsCount > 0
        ? `${destinations.defaultCidrsCount} default destination${destinations.defaultCidrsCount === 1 ? '' : 's'}`
        : 'no resolved default destinations';
    const customSummary = `${customCount} custom CIDR${customCount === 1 ? '' : 's'}`;
    const unresolvedSummary =
      destinations.unresolvedDefaults.length > 0
        ? ` Unresolved defaults: ${destinations.unresolvedDefaults.join(', ')}.`
        : '';

    return `Applied policy for ${containerIp}. Allowed ${defaultSummary} plus ${customSummary}.${unresolvedSummary}`;
  }

  /**
   * Executes the configured iptables binary.
   * Some cleanup paths intentionally ignore failures to keep rule removal idempotent.
   */
  private async run(args: string[], ignoreFailure = false) {
    const binary = this.config.getOrThrow<string>('app.docker.iptablesBinary');
    try {
      await execFileAsync(binary, args);
      return { ok: true };
    } catch (error) {
      if (ignoreFailure) {
        return { ok: false };
      }

      throw error;
    }
  }
}
