import { Test } from '@nestjs/testing';
import { SettingsService } from '../../../settings/settings.service';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerOperationSettingsService } from './docker-operation-settings.service';
import type { DockerOperationLimits } from '../../contracts/docker-operation-limits';

const defaults: DockerOperationLimits = {
  maxConcurrentReads: 8,
  maxConcurrentLongOperations: 4,
  slowRequestWarningMs: 5000,
  longOperationTimeoutMs: 1_800_000,
};

it('loads persisted limits, applies saves and resets, and unsubscribes at shutdown', async () => {
  const stored = { ...defaults, maxConcurrentReads: 3 };
  let current = { ...defaults };
  let listener: (value: DockerOperationLimits | undefined) => void = () =>
    undefined;
  const unsubscribe = jest.fn();
  const settings = {
    getDockerOperationLimits: jest.fn().mockResolvedValue(stored),
    subscribeDockerOperationLimits: jest.fn((callback) => {
      listener = callback;
      return unsubscribe;
    }),
    updateDockerOperationLimits: jest.fn(async (value) => {
      listener(value);
    }),
  };
  const engine = {
    getOperationLimits: () => ({ ...current }),
    setOperationLimits: jest.fn((value) => {
      current = value;
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      DockerOperationSettingsService,
      { provide: SettingsService, useValue: settings },
      { provide: DockerEngineService, useValue: engine },
    ],
  }).compile();
  const service = module.get(DockerOperationSettingsService);
  await service.onModuleInit();
  expect(service.getLimits()).toEqual(stored);
  const update = { ...stored, maxConcurrentLongOperations: 2 };
  expect(await service.updateLimits(update)).toEqual(update);
  expect(settings.updateDockerOperationLimits).toHaveBeenCalledWith(update);
  listener(undefined);
  expect(service.getLimits()).toEqual(defaults);
  service.onModuleDestroy();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  await module.close();
});
