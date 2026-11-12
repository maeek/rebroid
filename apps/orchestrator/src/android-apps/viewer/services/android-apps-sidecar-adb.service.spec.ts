import { setTimeout as delay } from 'node:timers/promises';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidAppsRuntimeOperationGate } from '../../common/services/android-apps-runtime-operation-gate.service';
import { AndroidAppsSidecarAdbService } from './android-apps-sidecar-adb.service';

describe('AndroidAppsSidecarAdbService UI text deadline', () => {
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };
  const app = { id: 'app-1', adbPort: 5555 };
  const input = {
    text: 'Żappka',
    match: 'exact',
    operation: 'tap',
    timeoutMs: 100,
    intervalMs: 250,
  } as const;

  const createService = (prepareNetwork: () => Promise<void>) =>
    new AndroidAppsSidecarAdbService(
      {
        getOrThrow: () => 'http://sidecar.test',
        get: () => undefined,
      } as never,
      {
        requireViewerTarget: async (_app: unknown, signal?: AbortSignal) => {
          await prepareNetwork();
          signal?.throwIfAborted();
          return { udid: '10.0.0.2:5555' };
        },
        invalidateViewerTarget: jest.fn(),
      } as never,
    );

  afterEach(() => jest.restoreAllMocks());

  it.each(['wait', 'tap'] as const)(
    'drains target preparation before reporting a %s timeout',
    async (operation) => {
      const prepare = deferred<void>();
      const service = createService(() => prepare.promise);
      const fetch = jest.spyOn(globalThis, 'fetch');
      const settled = jest.fn();
      const command = service.uiText(app as never, { ...input, operation });
      void command.then(settled, settled);
      try {
        await delay(input.timeoutMs + 25);
        expect(settled).not.toHaveBeenCalled();
      } finally {
        prepare.resolve();
      }
      await expect(command).rejects.toMatchObject({ name: 'TimeoutError' });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('keeps Stop fenced while canceled text-command preparation drains', async () => {
    const started = deferred<void>();
    const prepare = deferred<void>();
    const service = createService(() => {
      started.resolve();
      return prepare.promise;
    });
    const target = {
      ...app,
      status: AndroidApplicationStatus.Running,
      containerId: 'container',
      containerStartedAt: '2026-11-12T10:00:00Z',
    };
    const gate = new AndroidAppsRuntimeOperationGate(
      { getStored: async () => target } as never,
      {
        inspectContainer: async () => ({
          Id: target.containerId,
          State: { Running: true, StartedAt: target.containerStartedAt },
        }),
      } as never,
    );
    const controller = new AbortController();
    const fetch = jest.spyOn(globalThis, 'fetch');
    const command = gate.run(target as never, controller.signal, () =>
      service.uiText(
        target as never,
        { ...input, timeoutMs: 2000 },
        controller.signal,
      ),
    );
    const canceled = expect(command).rejects.toMatchObject({
      name: 'AbortError',
    });
    await started.promise;
    controller.abort();
    const stop = jest.fn();
    const stopping = gate.interrupt(target.id, stop);
    try {
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(stop).not.toHaveBeenCalled();
    } finally {
      prepare.resolve();
      await canceled;
      await stopping;
    }
    expect(stop).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('passes the remaining timeout to the sidecar and aborts an in-flight wait on cancellation', async () => {
    const service = createService(async () => {});
    const controller = new AbortController();
    const dispatched = deferred<RequestInit>();
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_url, init) => {
        dispatched.resolve(init!);
        return new Promise(() => {});
      });
    const operation = service.uiText(
      app as never,
      { ...input, operation: 'wait', timeoutMs: 2000 },
      controller.signal,
    );
    const init = await dispatched.promise;
    const payload = JSON.parse(init.body as string);
    expect(payload).toMatchObject({
      text: 'Żappka',
      match: 'exact',
      operation: 'wait',
      intervalMs: 250,
    });
    expect(payload.timeoutMs).toBeGreaterThan(0);
    expect(payload.timeoutMs).toBeLessThanOrEqual(2000);
    controller.abort();
    await expect(operation).rejects.toMatchObject({ name: 'AbortError' });
    expect(init.signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('cancels a text tap without releasing its response before acknowledgement', async () => {
    const service = createService(async () => {});
    const controller = new AbortController();
    const dispatched = deferred<RequestInit>();
    const cancel = deferred<string>();
    const response = deferred<Response>();
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((url, init) => {
        if (init?.method === 'DELETE') {
          cancel.resolve(String(url));
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        dispatched.resolve(init!);
        return response.promise;
      });
    const tap = service.uiText(
      app as never,
      { ...input, timeoutMs: 2000 },
      controller.signal,
    );
    const settled = jest.fn();
    const canceled = expect(tap)
      .rejects.toMatchObject({ name: 'AbortError' })
      .then(settled);
    const init = await dispatched.promise;
    const { operationId } = JSON.parse(init.body as string);
    expect(operationId).toEqual(expect.any(String));
    controller.abort();
    expect(await cancel.promise).toContain(`/ui-text/${operationId}`);
    expect(init.signal?.aborted).toBe(false);
    expect(settled).not.toHaveBeenCalled();
    response.resolve(
      Response.json(
        { message: 'UI text operation was canceled.' },
        { status: 409 },
      ),
    );
    await canceled;
    expect(settled).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('accepts a confirmed tap during the acknowledgement grace period', async () => {
    const service = createService(async () => {});
    const response = deferred<Response>();
    const deadlineReached = deferred<void>();
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_url, init) => {
        if (init?.method === 'DELETE') {
          deadlineReached.resolve();
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return response.promise;
      });
    const tap = service.uiText(app as never, input);
    const confirmed = expect(tap).resolves.toEqual({
      status: 'found',
      x: 10,
      y: 20,
    });
    const keepAlive = setTimeout(() => {}, 2000);
    try {
      await deadlineReached.promise;
      response.resolve(Response.json({ status: 'found', x: 10, y: 20 }));
      await confirmed;
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      clearTimeout(keepAlive);
    }
  });

  it('caps the sidecar shell budget after target preparation consumes part of an AI deadline', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const service = createService(async () => {
      now.mockReturnValue(1900);
    });
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ stdout: '', stderr: '', exitCode: 0 }),
      );
    await service.shell(
      app as never,
      'pm list packages',
      120_000,
      undefined,
      2000,
    );
    const request = fetch.mock.calls[0]?.[1];
    expect(JSON.parse(request?.body as string)).toEqual({
      command: 'pm list packages',
      timeoutMs: 100,
    });
  });

  it.each([null, {}, { executed: false }, { executed: 'true' }])(
    'rejects unconfirmed ADB input with response %j',
    async (payload) => {
      const service = createService(async () => {});
      const fetch = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(Response.json(payload));
      await expect(service.tap(app as never, 1, 2)).rejects.toThrow(
        'Display sidecar did not confirm the ADB input command.',
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps a dispatched tap pending until the sidecar responds after cancellation', async () => {
    const service = createService(async () => {});
    const controller = new AbortController();
    const response = deferred<Response>();
    const dispatched = deferred<AbortSignal>();
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_url, init) => {
        dispatched.resolve(init!.signal!);
        return response.promise;
      });
    const settled = jest.fn();
    const command = service
      .tap(app as never, 1, 2, controller.signal)
      .then(settled);
    const transportSignal = await dispatched.promise;
    controller.abort();
    expect(transportSignal.aborted).toBe(false);
    expect(settled).not.toHaveBeenCalled();
    response.resolve(Response.json({ executed: true }));
    await command;
    expect(settled).toHaveBeenCalledWith({ executed: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch a file write canceled during target preparation', async () => {
    const prepare = deferred<void>();
    const service = createService(() => prepare.promise);
    const fetch = jest.spyOn(globalThis, 'fetch');
    const controller = new AbortController();
    const command = service.pushFile(
      app as never,
      '/sdcard/file.txt',
      'Zg==',
      controller.signal,
    );
    controller.abort();
    prepare.resolve();
    await expect(command).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
