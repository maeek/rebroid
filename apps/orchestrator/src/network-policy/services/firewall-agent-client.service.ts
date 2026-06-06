import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'node:http';
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
  constructor(private readonly config: ConfigService) {}

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
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const socketPath = this.config.getOrThrow<string>(
      'app.firewallAgent.socketPath',
    );
    const sharedSecret = this.config.getOrThrow<string>(
      'app.firewallAgent.sharedSecret',
    );

    return new Promise((resolve, reject) => {
      const operation = request(
        {
          socketPath,
          path,
          method,
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
      operation.setTimeout(FIREWALL_AGENT_TIMEOUT_MS, () => {
        operation.destroy(
          new Error(
            `Firewall agent request timed out after ${FIREWALL_AGENT_TIMEOUT_MS}ms.`,
          ),
        );
      });
      if (payload) {
        operation.write(payload);
      }
      operation.end();
    });
  }
}
