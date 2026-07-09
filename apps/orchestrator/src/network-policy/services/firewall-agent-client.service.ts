import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { OrchestratorSettingsStore } from '../../settings/orchestrator-settings-store';
import type { FirewallAgentPolicy } from '@rebroid/firewall-policy-core/policy';

const FIREWALL_AGENT_TIMEOUT_MS = 5_000;

export interface FirewallAgentResponse {
  ok?: boolean;
  status?: string;
  adapter?: string | null;
  message?: string;
}

@Injectable()
export class FirewallAgentClientService {
  constructor(
    private readonly config: ConfigService,
    private readonly settingsStore: OrchestratorSettingsStore,
  ) {}

  health() {
    return this.send('GET', '/v1/health', undefined, false);
  }

  apply(applicationId: string, policy: FirewallAgentPolicy) {
    return this.send(
      'PUT',
      `/v1/policies/${encodeURIComponent(applicationId)}`,
      policy,
    );
  }

  remove(applicationId: string) {
    return this.send(
      'DELETE',
      `/v1/policies/${encodeURIComponent(applicationId)}`,
    );
  }

  reconcile(policies: Array<FirewallAgentPolicy & { applicationId: string }>) {
    return this.send('PUT', '/v1/reconcile', { policies });
  }

  private send(
    method: string,
    path: string,
    body?: unknown,
    authenticated = true,
  ): Promise<FirewallAgentResponse> {
    return this.settingsStore.getStoredSettings().then((settings) => {
      const service = settings.services.firewall;
      if (!service.enabled) {
        if (!authenticated) {
          return {
            ok: true,
            status: 'disabled',
            message: 'Firewall agent integration is disabled.',
          };
        }
        throw new Error('Firewall agent integration is disabled.');
      }

      const endpoint = service.endpoint?.trim();
      if (!endpoint) {
        throw new Error('Firewall agent endpoint is not configured.');
      }

      return this.sendWithEndpoint(
        endpoint,
        service.timeoutMs || FIREWALL_AGENT_TIMEOUT_MS,
        method,
        path,
        body,
        authenticated,
      );
    });
  }

  private sendWithEndpoint(
    endpoint: string,
    timeoutMs: number,
    method: string,
    path: string,
    body?: unknown,
    authenticated = true,
  ): Promise<FirewallAgentResponse> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const sharedSecret = this.config.getOrThrow<string>(
      'app.firewallAgent.sharedSecret',
    );
    const requestImpl = endpoint.startsWith('https://')
      ? httpsRequest
      : httpRequest;
    const requestOptions = this.requestOptions(endpoint, path, method);

    return new Promise((resolve, reject) => {
      const operation = requestImpl(
        {
          ...requestOptions,
          headers: {
            accept: 'application/json',
            ...(authenticated
              ? { 'x-firewall-agent-secret': sharedSecret }
              : {}),
            ...(payload
              ? {
                  'content-type': 'application/json',
                  'content-length': Buffer.byteLength(payload),
                }
              : {}),
          },
        },
        (response) => {
          let responseBody = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            responseBody += chunk;
          });
          response.on('end', () => {
            let parsed: FirewallAgentResponse;
            try {
              parsed = responseBody ? JSON.parse(responseBody) : {};
            } catch {
              reject(new Error('Firewall agent returned invalid JSON.'));
              return;
            }

            if ((response.statusCode ?? 500) >= 400) {
              reject(
                new Error(parsed.message || 'Firewall agent request failed.'),
              );
              return;
            }
            resolve(parsed);
          });
        },
      );
      operation.on('error', (error) => {
        reject(new Error(error.message || 'Firewall agent is unavailable.'));
      });
      operation.setTimeout(timeoutMs, () => {
        operation.destroy(
          new Error(`Firewall agent request timed out after ${timeoutMs}ms.`),
        );
      });
      if (payload) {
        operation.write(payload);
      }
      operation.end();
    });
  }

  private requestOptions(endpoint: string, path: string, method: string) {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      const url = new URL(path, endpoint);
      return {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
      };
    }

    return {
      socketPath: endpoint,
      path,
      method,
    };
  }
}
