import { OrchestratorDiagnosticsService } from './orchestrator-diagnostics.service';

const healthy = { ok: true, status: 'healthy', message: 'Healthy' } as const;
const disabled = { ok: true, status: 'disabled', message: 'Disabled' } as const;

const setup = () => {
  const docker = {
    dockerHealthSummary: jest.fn().mockResolvedValue(healthy),
    runtimeSuitabilityHealthSummary: jest.fn().mockResolvedValue(healthy),
    displaySidecarSummaryHealth: jest.fn().mockResolvedValue(healthy),
    dockerHealth: jest.fn().mockResolvedValue(healthy),
    runtimeSuitabilityHealth: jest.fn().mockResolvedValue(healthy),
    displaySidecarHealth: jest.fn().mockResolvedValue(healthy),
  };
  const firewall = { health: jest.fn().mockResolvedValue(healthy) };
  const ocr = { health: jest.fn().mockResolvedValue(healthy) };
  let settingsChanged!: () => void;
  const unsubscribe = jest.fn();
  const settings = {
    subscribeDiagnosticInputs: (changed: () => void) => {
      settingsChanged = changed;
      return unsubscribe;
    },
  };
  const diagnostics = new OrchestratorDiagnosticsService(
    docker as never,
    firewall as never,
    ocr as never,
    settings as never,
  );
  return {
    diagnostics,
    docker,
    firewall,
    ocr,
    unsubscribe,
    updateSettings: settingsChanged,
  };
};

afterEach(() => jest.useRealTimers());

it('coalesces concurrent summaries and reuses recent probes while full diagnostics probe afresh', async () => {
  jest.useFakeTimers();
  const { diagnostics, docker, firewall, ocr } = setup();
  await Promise.all([diagnostics.read(true), diagnostics.read(true)]);
  jest.advanceTimersByTime(4_999);
  await diagnostics.read(true);
  expect(docker.displaySidecarSummaryHealth).toHaveBeenCalledTimes(1);
  expect(firewall.health).toHaveBeenCalledTimes(1);
  expect(ocr.health).toHaveBeenCalledTimes(1);

  await diagnostics.read(false);
  expect(docker.displaySidecarHealth).toHaveBeenCalledTimes(1);
  expect(firewall.health).toHaveBeenCalledTimes(2);
  expect(ocr.health).toHaveBeenCalledTimes(2);

  jest.advanceTimersByTime(1);
  await diagnostics.read(true);
  expect(docker.displaySidecarSummaryHealth).toHaveBeenCalledTimes(2);
  expect(firewall.health).toHaveBeenCalledTimes(3);
  expect(ocr.health).toHaveBeenCalledTimes(3);
});

it('fences a pending probe after a settings change and reports the current feature state', async () => {
  const { diagnostics, firewall, ocr, updateSettings, unsubscribe } = setup();
  let resolveOld!: (value: typeof healthy) => void;
  firewall.health.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const first = diagnostics.read(true);
  firewall.health.mockResolvedValue(disabled);
  ocr.health.mockResolvedValue(disabled);
  updateSettings();
  const current = await diagnostics.read(true);
  resolveOld(healthy);
  expect(await first).toEqual(current);
  expect(current.services.firewall.status).toBe('disabled');
  expect(current.services.ocr.status).toBe('disabled');
  expect((await diagnostics.read(true)).services.firewall.status).toBe(
    'disabled',
  );
  expect(firewall.health).toHaveBeenCalledTimes(2);
  diagnostics.onModuleDestroy();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('does not publish a settled probe from old settings while another probe is pending', async () => {
  const { diagnostics, docker, firewall, updateSettings } = setup();
  let settleDisplay!: (value: typeof healthy) => void;
  docker.displaySidecarSummaryHealth.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settleDisplay = resolve;
      }),
  );
  const reading = diagnostics.read(true);
  await Promise.resolve();
  firewall.health.mockResolvedValue(disabled);
  updateSettings();
  settleDisplay(healthy);

  expect((await reading).services.firewall.status).toBe('disabled');
  expect(firewall.health).toHaveBeenCalledTimes(2);
  expect(docker.displaySidecarSummaryHealth).toHaveBeenCalledTimes(1);
});

it('retries a rejected probe on the next summary request', async () => {
  const { diagnostics, ocr } = setup();
  ocr.health.mockRejectedValueOnce(new Error('settings unavailable'));
  await expect(diagnostics.read(true)).rejects.toThrow('settings unavailable');
  await expect(diagnostics.read(true)).resolves.toMatchObject({ ocr: true });
  expect(ocr.health).toHaveBeenCalledTimes(2);
});
