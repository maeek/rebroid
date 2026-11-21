import {
  Inject,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DOCKER_HEALTH,
  type DockerHealthPort,
} from '../docker/contracts/docker-health.port';
import {
  FirewallAgentClientService,
  type FirewallAgentResponse,
} from '../network-policy/services/firewall-agent-client.service';
import { SettingsService } from '../settings/settings.service';
import type { ServiceHealthDto } from './dto/health-response.dto';
import { OcrSidecarHealthService } from './ocr-sidecar-health.service';

const SUMMARY_PROBE_FRESHNESS_MS = 5_000;
const RUNTIME_PROBE_FRESHNESS_MS = 60_000;

class SummaryProbe<T> {
  private pending?: Promise<T>;
  private sample?: { value: T; expiresAt: number };
  private revision = 0;

  constructor(private readonly freshnessMs = SUMMARY_PROBE_FRESHNESS_MS) {}

  invalidate() {
    this.revision += 1;
    this.pending = undefined;
    this.sample = undefined;
  }

  read(useCache: boolean, collect: () => Promise<T>): Promise<T> {
    if (!useCache) return collect();
    if (this.sample && this.sample.expiresAt > Date.now()) {
      return Promise.resolve(this.sample.value);
    }
    if (this.pending) return this.pending;

    const revision = this.revision;
    const pending = collect()
      .then((value) => {
        if (revision === this.revision) {
          this.sample = {
            value,
            expiresAt: Date.now() + this.freshnessMs,
          };
        }
        return value;
      })
      .finally(() => {
        if (this.pending === pending) this.pending = undefined;
      });
    this.pending = pending;
    return pending;
  }
}

@Injectable()
export class OrchestratorDiagnosticsService implements OnModuleDestroy {
  private readonly dockerAvailability = new SummaryProbe<ServiceHealthDto>();
  private readonly runtime = new SummaryProbe<ServiceHealthDto>(
    RUNTIME_PROBE_FRESHNESS_MS,
  );
  private readonly display = new SummaryProbe<ServiceHealthDto>();
  private readonly firewall = new SummaryProbe<FirewallAgentResponse>();
  private readonly ocr = new SummaryProbe<ServiceHealthDto>();
  private readonly unsubscribe: () => void;
  private summarySettingsRevision = 0;

  constructor(
    @Inject(DOCKER_HEALTH) private readonly docker: DockerHealthPort,
    private readonly firewallAgent: FirewallAgentClientService,
    private readonly ocrSidecar: OcrSidecarHealthService,
    settings: SettingsService,
  ) {
    this.unsubscribe = settings.subscribeDiagnosticInputs(() => {
      this.summarySettingsRevision += 1;
      this.firewall.invalidate();
      this.ocr.invalidate();
    });
  }

  onModuleDestroy() {
    this.unsubscribe();
  }

  async read(summary: boolean) {
    if (!summary) return this.collect(false);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const revision = this.summarySettingsRevision;
      try {
        const reading = await this.collect(true);
        if (revision === this.summarySettingsRevision) return reading;
      } catch (error) {
        if (revision === this.summarySettingsRevision) throw error;
      }
    }
    throw new ServiceUnavailableException(
      'Diagnostic settings changed. Try again.',
    );
  }

  private async collect(summary: boolean) {
    const [docker, display, firewall, ocr] = await Promise.all([
      this.dockerAvailability.read(summary, () => this.docker.dockerHealth()),
      this.display.read(summary, () =>
        summary
          ? this.docker.displaySidecarSummaryHealth()
          : this.docker.displaySidecarHealth(),
      ),
      this.firewall.read(summary, () => this.firewallHealth()),
      this.ocr.read(summary, () => this.ocrSidecar.health()),
    ]);
    const runtime = docker.ok
      ? await this.runtime.read(summary, () =>
          this.docker.runtimeSuitabilityHealth(),
        )
      : {
          ok: false,
          status: 'offline' as const,
          message:
            'Docker is unavailable, so runtime suitability cannot be inspected.',
        };

    return {
      ok: docker.ok && runtime.ok && display.ok && firewall.ok && ocr.ok,
      docker: docker.ok,
      runtime: runtime.ok,
      display: display.ok,
      firewall: Boolean(firewall.ok),
      ocr: ocr.ok,
      services: {
        orchestrator: {
          ok: true,
          status: 'healthy',
          message: 'Orchestrator API is responding.',
        },
        docker,
        runtime,
        display,
        firewall,
        ocr,
      },
    };
  }

  private firewallHealth() {
    return this.firewallAgent.health().catch((error: unknown) => ({
      ok: false,
      status: 'offline',
      message:
        error instanceof Error
          ? error.message
          : 'Firewall agent is unavailable.',
    }));
  }
}
