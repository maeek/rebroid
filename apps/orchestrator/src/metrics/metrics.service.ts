import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

export type DockerOperationClass = 'read' | 'mutation' | 'long';
export type DockerOperationOutcome = 'success' | 'error' | 'timeout';

interface DockerOperationAggregate {
  class: DockerOperationClass;
  operation: string;
  success: number;
  errors: number;
  timeouts: number;
  retries: number;
  slow: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

interface DockerOperationEvent {
  timestamp: string;
  class: DockerOperationClass;
  operation: string;
  outcome: 'error' | 'timeout' | 'slow';
  durationMs: number;
  error: string | null;
}

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly dockerOperations: Counter;
  private readonly dockerDurations: Histogram;
  private readonly dockerRetries: Counter;
  private readonly dockerSlowOperations: Counter;
  private readonly dockerInFlight: Gauge;
  private readonly dockerQueued: Gauge;
  private readonly automationRuns: Counter;
  private readonly automationRunDurations: Histogram;
  private readonly automationActiveRuns: Gauge;
  private readonly aiProviderRequests: Counter;
  private readonly aiProviderDurations: Histogram;
  private readonly automationEventDurations: Histogram;
  private readonly aggregates = new Map<string, DockerOperationAggregate>();
  private readonly inFlight = { read: 0, mutation: 0, long: 0 };
  private readonly queued = { read: 0, mutation: 0, long: 0 };
  private readonly events: DockerOperationEvent[] = [];
  private transport = 'local-socket';
  private limits = {
    maxConcurrentReads: 0,
    maxConcurrentLongOperations: 0,
    slowRequestWarningMs: 0,
    longOperationTimeoutMs: 0,
    remoteRequestTimeoutMs: 0,
  };

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'rebroid_' });
    this.dockerOperations = new Counter({
      name: 'rebroid_docker_api_operations_total',
      help: 'Completed Docker API operations.',
      labelNames: ['class', 'operation', 'outcome'],
      registers: [this.registry],
    });
    this.dockerDurations = new Histogram({
      name: 'rebroid_docker_api_operation_duration_seconds',
      help: 'Docker API operation duration.',
      labelNames: ['class', 'operation', 'outcome'],
      registers: [this.registry],
    });
    this.dockerRetries = new Counter({
      name: 'rebroid_docker_api_retries_total',
      help: 'Retried Docker API reads.',
      labelNames: ['operation', 'error'],
      registers: [this.registry],
    });
    this.dockerSlowOperations = new Counter({
      name: 'rebroid_docker_api_slow_operations_total',
      help: 'Docker API operations that exceeded the warning threshold.',
      labelNames: ['class', 'operation'],
      registers: [this.registry],
    });
    this.dockerInFlight = new Gauge({
      name: 'rebroid_docker_api_in_flight',
      help: 'Docker API operations currently in flight.',
      labelNames: ['class'],
      registers: [this.registry],
    });
    this.dockerQueued = new Gauge({
      name: 'rebroid_docker_api_queued',
      help: 'Docker API operations waiting for a concurrency permit.',
      labelNames: ['class'],
      registers: [this.registry],
    });
    this.automationRuns = new Counter({
      name: 'rebroid_automation_runs_total',
      help: 'Completed automation runs by trigger and outcome.',
      labelNames: ['trigger', 'outcome'],
      registers: [this.registry],
    });
    this.automationRunDurations = new Histogram({
      name: 'rebroid_automation_run_duration_seconds',
      help: 'Automation run duration from execution start to terminal state.',
      labelNames: ['trigger', 'outcome'],
      registers: [this.registry],
    });
    this.automationActiveRuns = new Gauge({
      name: 'rebroid_automation_active_runs',
      help: 'Automation runs currently executing in this process.',
      registers: [this.registry],
    });
    this.aiProviderRequests = new Counter({
      name: 'rebroid_ai_provider_requests_total',
      help: 'AI provider requests by bounded operation, role, and outcome.',
      labelNames: ['operation', 'role', 'outcome'],
      registers: [this.registry],
    });
    this.aiProviderDurations = new Histogram({
      name: 'rebroid_ai_provider_request_duration_seconds',
      help: 'AI provider request duration.',
      labelNames: ['operation', 'role', 'outcome'],
      registers: [this.registry],
    });
    this.automationEventDurations = new Histogram({
      name: 'rebroid_automation_event_persistence_duration_seconds',
      help: 'Automation event persistence duration.',
      labelNames: ['outcome'],
      registers: [this.registry],
    });
  }

  automationRunStarted() {
    this.automationActiveRuns.inc();
  }

  automationRunFinished(
    trigger: string,
    outcome: string,
    startedAt: Date | null,
  ) {
    if (startedAt) {
      this.automationActiveRuns.dec();
    }
    this.automationRuns.inc({ trigger, outcome });
    if (startedAt) {
      this.automationRunDurations.observe(
        { trigger, outcome },
        Math.max(0, Date.now() - startedAt.getTime()) / 1000,
      );
    }
  }

  beginAiProviderRequest(
    operation: 'chat' | 'health' | 'models',
    role: 'provider' | 'planner' | 'vision',
  ) {
    const startedAt = Date.now();
    return (outcome: 'success' | 'error' | 'timeout') => {
      const labels = { operation, role, outcome };
      this.aiProviderRequests.inc(labels);
      this.aiProviderDurations.observe(labels, (Date.now() - startedAt) / 1000);
    };
  }

  beginAutomationEventPersistence() {
    const startedAt = Date.now();
    return (outcome: 'success' | 'error') => {
      this.automationEventDurations.observe(
        { outcome },
        (Date.now() - startedAt) / 1000,
      );
    };
  }

  configureDocker(transport: string, limits: MetricsService['limits']) {
    this.transport = transport;
    this.limits = { ...limits };
  }

  queueDockerOperation(className: DockerOperationClass, delta: number) {
    this.queued[className] += delta;
    this.dockerQueued.set({ class: className }, this.queued[className]);
  }

  beginDockerOperation(className: DockerOperationClass, operation: string) {
    const startedAt = Date.now();
    this.inFlight[className] += 1;
    this.dockerInFlight.set({ class: className }, this.inFlight[className]);
    return (outcome: DockerOperationOutcome, error: string | null = null) => {
      const durationMs = Date.now() - startedAt;
      this.inFlight[className] -= 1;
      this.dockerInFlight.set({ class: className }, this.inFlight[className]);
      this.dockerOperations.inc({ class: className, operation, outcome });
      this.dockerDurations.observe(
        { class: className, operation, outcome },
        durationMs / 1000,
      );
      const aggregate = this.aggregate(className, operation);
      aggregate.totalDurationMs += durationMs;
      aggregate.maxDurationMs = Math.max(aggregate.maxDurationMs, durationMs);
      if (outcome === 'success') aggregate.success += 1;
      if (outcome === 'error') aggregate.errors += 1;
      if (outcome === 'timeout') aggregate.timeouts += 1;
      if (outcome !== 'success') {
        this.pushEvent({
          class: className,
          operation,
          outcome,
          durationMs,
          error,
        });
      }
    };
  }

  recordDockerRetry(operation: string, error: string) {
    this.dockerRetries.inc({ operation, error });
    this.aggregate('read', operation).retries += 1;
  }

  recordSlowDockerOperation(
    className: DockerOperationClass,
    operation: string,
    durationMs: number,
  ) {
    this.dockerSlowOperations.inc({ class: className, operation });
    this.aggregate(className, operation).slow += 1;
    this.pushEvent({
      class: className,
      operation,
      outcome: 'slow',
      durationMs,
      error: null,
    });
  }

  dockerSnapshot() {
    const totals = [...this.aggregates.values()].reduce(
      (sum, item) => ({
        success: sum.success + item.success,
        errors: sum.errors + item.errors,
        timeouts: sum.timeouts + item.timeouts,
        retries: sum.retries + item.retries,
        slow: sum.slow + item.slow,
      }),
      { success: 0, errors: 0, timeouts: 0, retries: 0, slow: 0 },
    );

    return {
      collectedAt: new Date().toISOString(),
      transport: this.transport,
      limits: this.limits,
      totals,
      inFlight: this.inFlight,
      queued: this.queued,
      operations: [...this.aggregates.values()]
        .map((item) => ({
          ...item,
          averageDurationMs:
            item.success + item.errors + item.timeouts > 0
              ? Math.round(
                  item.totalDurationMs /
                    (item.success + item.errors + item.timeouts),
                )
              : 0,
        }))
        .sort((left, right) => left.operation.localeCompare(right.operation)),
      events: [...this.events],
    };
  }

  private aggregate(className: DockerOperationClass, operation: string) {
    const key = `${className}:${operation}`;
    let aggregate = this.aggregates.get(key);
    if (!aggregate) {
      aggregate = {
        class: className,
        operation,
        success: 0,
        errors: 0,
        timeouts: 0,
        retries: 0,
        slow: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
      };
      this.aggregates.set(key, aggregate);
    }
    return aggregate;
  }

  private pushEvent(event: Omit<DockerOperationEvent, 'timestamp'>) {
    this.events.unshift({ timestamp: new Date().toISOString(), ...event });
    this.events.splice(50);
  }
}
