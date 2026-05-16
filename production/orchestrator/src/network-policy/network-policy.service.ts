import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { promisify } from 'node:util';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { DockerService } from '../docker/docker.service';

const execFileAsync = promisify(execFile);

export interface AppliedNetworkPolicy {
  status: 'applied' | 'skipped' | 'error';
  message: string;
}

interface AllowedDestinations {
  cidrs: string[];
  customCidrs: string[];
  defaultCidrsCount: number;
  unresolvedDefaults: string[];
}

interface ResolvedDefaultDestinations {
  cidrs: string[];
  unresolved: string[];
}

@Injectable()
export class NetworkPolicyService {
  private readonly logger = new Logger(NetworkPolicyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly docker: DockerService,
  ) {}

  async apply(app: AndroidApplication): Promise<AppliedNetworkPolicy> {
    if (!this.config.getOrThrow<boolean>('app.docker.iptablesEnabled')) {
      return {
        status: 'skipped',
        message: 'IPTables policy is disabled. Set IPTABLES_POLICY_ENABLED=true on the Linux host.',
      };
    }

    if (!app.containerId) {
      return { status: 'skipped', message: 'Container has not been created yet.' };
    }

    if (!app.networkPolicyEnabled) {
      await this.remove(app);
      return { status: 'skipped', message: 'Network policy is disabled for this application.' };
    }

    const containerIp = await this.docker.getContainerIp(app.containerId, app.networkName);
    if (!containerIp) {
      return { status: 'skipped', message: 'Container IP address is not available yet.' };
    }

    const destinations = await this.allowedDestinations(app);
    const chain = this.chainName(app.id);

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
      const message = error instanceof Error ? error.message : 'Unknown iptables error';
      this.logger.error(message);
      return { status: 'error', message };
    }
  }

  async remove(app: Pick<AndroidApplication, 'id' | 'containerId' | 'networkName'>) {
    if (!this.config.get<boolean>('app.docker.iptablesEnabled')) {
      return;
    }

    const chain = this.chainName(app.id);
    if (app.containerId) {
      const containerIp = await this.docker.getContainerIp(app.containerId, app.networkName).catch(() => null);
      if (containerIp) {
        await this.run(['-D', 'DOCKER-USER', '-s', containerIp, '-j', chain], true);
      }
    }
    await this.run(['-F', chain], true);
    await this.run(['-X', chain], true);
  }

  private async allowedDestinations(app: AndroidApplication): Promise<AllowedDestinations> {
    const customCidrs = this.parseAllowCidrs(app.networkPolicyAllowCidrs);
    const defaultDestinations = await this.resolveDefaultDestinations(app);
    const cidrs = this.unique([...defaultDestinations.cidrs, ...customCidrs]);

    return {
      cidrs,
      customCidrs,
      defaultCidrsCount: defaultDestinations.cidrs.length,
      unresolvedDefaults: defaultDestinations.unresolved,
    };
  }

  private async resolveDefaultDestinations(app: AndroidApplication): Promise<ResolvedDefaultDestinations> {
    const destinations = this.config.get<string[]>('app.networkPolicy.defaultAllowDestinations') ?? [
      'API_IP',
      'GATEWAY_IP',
    ];
    const cidrs: string[] = [];
    const unresolved: string[] = [];

    for (const destination of destinations) {
      const resolved = await this.resolveDefaultDestination(app, destination);
      cidrs.push(...resolved.cidrs);
      unresolved.push(...resolved.unresolved);
    }

    return {
      cidrs: this.unique(cidrs),
      unresolved: this.unique(unresolved),
    };
  }

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
        cidrs: this.unique([...api.cidrs, ...gateway.cidrs]),
        unresolved: this.unique([...api.unresolved, ...gateway.unresolved]),
      };
    }

    if (token === 'API_IP' || token === 'ORCHESTRATOR_IP') {
      const cidrs = await this.resolveApiCidrs(app);
      return cidrs.length > 0 ? { cidrs, unresolved: [] } : { cidrs: [], unresolved: [token] };
    }

    if (token === 'GATEWAY_IP') {
      const gatewayIp = await this.docker.getNetworkGateway(app.networkName);
      return gatewayIp ? { cidrs: [`${gatewayIp}/32`], unresolved: [] } : { cidrs: [], unresolved: [token] };
    }

    const cidr = this.normalizeIpv4Cidr(normalized);
    return cidr ? { cidrs: [cidr], unresolved: [] } : { cidrs: [], unresolved: [normalized] };
  }

  private async resolveApiCidrs(app: AndroidApplication): Promise<string[]> {
    const configuredCidrs = (this.config.get<string[]>('app.networkPolicy.apiCidrs') ?? [])
      .map((value) => this.normalizeIpv4Cidr(value))
      .filter((value): value is string => Boolean(value));
    const apiHostCidrs = await this.resolveApiHostCidrs();
    const attachedOrchestratorIp = await this.docker.getOrchestratorIp(app.networkName);
    const attachedOrchestratorCidr = attachedOrchestratorIp ? `${attachedOrchestratorIp}/32` : null;

    return this.unique([
      ...configuredCidrs,
      ...apiHostCidrs,
      ...(attachedOrchestratorCidr ? [attachedOrchestratorCidr] : []),
    ]);
  }

  private async resolveApiHostCidrs(): Promise<string[]> {
    const apiHost = this.config.get<string>('app.networkPolicy.apiHost');
    const hostname = this.extractHostname(apiHost);
    if (!hostname) {
      return [];
    }

    const directCidr = this.normalizeIpv4Cidr(hostname);
    if (directCidr) {
      return [directCidr];
    }

    try {
      const addresses = await lookup(hostname, { all: true, family: 4 });
      return this.unique(addresses.map((address) => `${address.address}/32`));
    } catch (error) {
      this.logger.warn(
        `Could not resolve NETWORK_POLICY_API_HOST "${hostname}": ${
          error instanceof Error ? error.message : 'unknown DNS error'
        }`,
      );
      return [];
    }
  }

  private extractHostname(value?: string) {
    if (!value?.trim()) {
      return null;
    }

    const trimmed = value.trim();
    try {
      return new URL(trimmed).hostname;
    } catch {
      try {
        return new URL(`http://${trimmed}`).hostname;
      } catch {
        return trimmed;
      }
    }
  }

  private async ensureDockerUserJump(containerIp: string, chain: string) {
    const rule = ['DOCKER-USER', '-s', containerIp, '-j', chain];
    const exists = await this.run(['-C', ...rule], true);
    if (!exists.ok) {
      await this.run(['-I', ...rule]);
    }
  }

  private parseAllowCidrs(value: string) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => this.normalizeIpv4Cidr(item))
        .filter((item): item is string => Boolean(item));
    } catch {
      return [];
    }
  }

  private normalizeIpv4Cidr(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const [address, prefix] = trimmed.split('/');
    if (isIP(address) !== 4) {
      return null;
    }

    if (prefix === undefined) {
      return `${address}/32`;
    }

    const numericPrefix = Number(prefix);
    if (!Number.isInteger(numericPrefix) || numericPrefix < 0 || numericPrefix > 32) {
      return null;
    }

    return `${address}/${numericPrefix}`;
  }

  private appliedMessage(containerIp: string, destinations: AllowedDestinations) {
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

  private unique(values: string[]) {
    return [...new Set(values)];
  }

  private chainName(applicationId: string) {
    return `SMA-${applicationId.replace(/-/g, '').slice(0, 24)}`;
  }

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
