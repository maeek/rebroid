import {
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrchestratorSettingsStore } from '../settings/orchestrator-settings-store';
import type { StoredOrchestratorSettings } from '../settings/orchestrator-settings-store';
import type {
  FeatureFlagManifestDto,
  FeatureFlagStateDto,
  UpdateFeatureFlagsDto,
} from './dto/feature-flags.dto';
import {
  defaultRuntimeFeatureFlagValues,
  featureFlagDefinitions,
  featureFlagRegistry,
  isFeatureFlagKey,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
} from './feature-flag.registry';

type FeatureSnapshot = Readonly<{
  revision: number;
  states: Readonly<Record<FeatureFlagKey, FeatureFlagStateDto>>;
}>;

export class FeatureDisabledException extends ConflictException {
  constructor(key: FeatureFlagKey) {
    super({
      statusCode: 409,
      code: 'feature_disabled',
      feature: key,
      message: `${key} is disabled.`,
    });
  }
}

@Injectable()
export class FeatureFlagsService implements OnModuleInit, OnModuleDestroy {
  private snapshot: FeatureSnapshot;
  private unsubscribe?: () => void;
  private readonly subscribers = new Set<() => void>();

  constructor(
    private readonly store: OrchestratorSettingsStore,
    private readonly config: ConfigService,
  ) {
    this.snapshot = this.buildSnapshot(this.store.defaults());
  }

  async onModuleInit() {
    this.unsubscribe = await this.store.subscribeWithCurrent(
      (settings, initial) => {
        if (
          !initial &&
          settings.featureFlags.revision === this.snapshot.revision
        )
          return;
        this.snapshot = this.buildSnapshot(settings);
        if (!initial) {
          for (const subscriber of this.subscribers) subscriber();
        }
      },
    );
  }

  onModuleDestroy() {
    this.unsubscribe?.();
    this.subscribers.clear();
  }

  getManifest(): FeatureFlagManifestDto {
    const snapshot = this.snapshot;
    return {
      revision: snapshot.revision,
      features: featureFlagDefinitions.map(({ key }) => snapshot.states[key]),
    };
  }

  isEnabled(key: FeatureFlagKey) {
    return this.snapshot.states[key].effective;
  }

  assertEnabled(key: FeatureFlagKey) {
    const state = this.snapshot.states[key];
    if (state.enabled && state.supported) return;
    if (state.supported) throw new FeatureDisabledException(key);
    throw new ConflictException({
      statusCode: 409,
      code: 'feature_unsupported',
      feature: key,
      message: `${key} is not supported by this deployment.`,
    });
  }

  subscribe(subscriber: () => void) {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  markSynchronization(
    key: FeatureFlagKey,
    revision: number,
    syncStatus: 'applied' | 'failed',
  ) {
    const current = this.snapshot;
    if (current.revision !== revision) return;
    const state = current.states[key];
    if (state.syncStatus === syncStatus) return;
    this.snapshot = Object.freeze({
      revision: current.revision,
      states: Object.freeze({
        ...current.states,
        [key]: Object.freeze({
          ...state,
          effective:
            syncStatus === 'applied' && state.enabled && state.supported,
          syncStatus,
        }),
      }),
    });
  }

  async update(dto: UpdateFeatureFlagsDto) {
    const seen = new Set<FeatureFlagKey>();
    for (const change of dto.changes) {
      if (!isFeatureFlagKey(change.key)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'unknown_feature',
          feature: change.key,
          message: `Unknown feature ${change.key}.`,
        });
      }
      if (seen.has(change.key)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'feature_dependency_conflict',
          feature: change.key,
          message: `Feature ${change.key} was changed more than once.`,
        });
      }
      seen.add(change.key);
    }

    await this.store.updateSettings((current) => {
      const persisted = current.featureFlags;
      if (persisted.revision !== dto.revision) {
        throw new ConflictException({
          statusCode: 409,
          code: 'feature_revision_conflict',
          expectedRevision: dto.revision,
          actualRevision: persisted.revision,
          message: 'Feature flags changed since they were loaded.',
        });
      }

      const values = { ...persisted.values };
      let changed = false;
      for (const change of dto.changes) {
        const definition = featureFlagRegistry[change.key];
        if (definition.control === 'deployment') {
          throw new ConflictException({
            statusCode: 409,
            code: 'feature_read_only',
            feature: change.key,
            message: `${change.key} is controlled by the deployment.`,
          });
        }
        if (change.enabled && !this.isSupported(definition)) {
          throw new ConflictException({
            statusCode: 409,
            code: 'feature_unsupported',
            feature: change.key,
            message: `${change.key} is not supported by this deployment.`,
          });
        }
        if (values[change.key] !== change.enabled) {
          values[change.key] = change.enabled;
          changed = true;
        }
      }

      this.validateRelationships(values);
      if (!changed) return current;

      return {
        ...current,
        featureFlags: { revision: persisted.revision + 1, values },
      };
    });

    return this.getManifest();
  }

  reset(revision: number) {
    const defaults = defaultRuntimeFeatureFlagValues((key) =>
      this.config.get(key),
    );
    return this.update({
      revision,
      changes: featureFlagDefinitions
        .filter((definition) => definition.control === 'runtime')
        .map((definition) => ({
          key: definition.key,
          enabled: defaults[definition.key] ?? false,
        })),
    });
  }

  private buildSnapshot(settings: StoredOrchestratorSettings): FeatureSnapshot {
    const states = {} as Record<FeatureFlagKey, FeatureFlagStateDto>;
    for (const definition of featureFlagDefinitions) {
      const supported = this.isSupported(definition);
      const enabled =
        definition.control === 'deployment'
          ? definition.defaultEnabled
          : (settings.featureFlags.values[definition.key] ??
            definition.defaultEnabled);
      const needsSynchronization = definition.owner === 'display';
      states[definition.key] = Object.freeze({
        key: definition.key,
        owner: definition.owner,
        revision: settings.featureFlags.revision,
        description: definition.description,
        control: definition.control,
        mutable: definition.control === 'runtime',
        enabled,
        supported,
        effective: enabled && supported && !needsSynchronization,
        syncStatus: needsSynchronization ? 'pending' : 'applied',
        disablePolicy: definition.disablePolicy,
        lifecycle: definition.lifecycle,
        removalCondition: definition.removalCondition,
        dependencies: [...definition.dependencies],
        conflicts: [...definition.conflicts],
      });
    }
    return Object.freeze({
      revision: settings.featureFlags.revision,
      states: Object.freeze(states),
    });
  }

  private isSupported(definition: FeatureFlagDefinition) {
    return definition.supportConfigKey
      ? Boolean(this.config.get<string>(definition.supportConfigKey))
      : true;
  }

  private validateRelationships(
    runtimeValues: Partial<Record<FeatureFlagKey, boolean>>,
  ) {
    const values = Object.fromEntries(
      featureFlagDefinitions.map((definition) => [
        definition.key,
        definition.control === 'deployment'
          ? definition.defaultEnabled
          : (runtimeValues[definition.key] ?? definition.defaultEnabled),
      ]),
    ) as Record<FeatureFlagKey, boolean>;
    for (const definition of featureFlagDefinitions) {
      if (!values[definition.key]) continue;
      const missing = definition.dependencies.find((key) => !values[key]);
      const conflict = definition.conflicts.find((key) => values[key]);
      if (!missing && !conflict) continue;
      throw new ConflictException({
        statusCode: 409,
        code: 'feature_dependency_conflict',
        feature: definition.key,
        relatedFeature: missing ?? conflict,
        message: missing
          ? `${definition.key} requires ${missing}.`
          : `${definition.key} conflicts with ${conflict}.`,
      });
    }
  }
}
