import { AndroidAppsSidecarAdbService } from './android-apps-sidecar-adb.service';

describe('AndroidAppsSidecarAdbService target cache', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('invalidates the prepared ADB target after a restart or container change', async () => {
    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,a',
            capturedAt: '2026-07-10T00:00:00.000Z',
          }),
          { status: 200 },
        ),
    );
    const network = {
      prepareNetwork: jest.fn(),
      resolveScrcpyAdbHost: jest.fn().mockResolvedValue('10.0.0.2'),
      prepareScrcpyAdbTarget: jest
        .fn()
        .mockResolvedValue({ configured: true, connected: true }),
    };
    const service = new AndroidAppsSidecarAdbService(
      {
        getOrThrow: jest.fn().mockReturnValue('http://sidecar.test'),
        get: jest.fn().mockReturnValue('secret'),
      } as never,
      network as never,
    );
    const app = {
      id: 'app-1',
      containerId: 'container-1',
      containerName: 'rebroid-app-1',
      networkName: 'rebroid-network-1',
      adbPort: 5555,
      lastStartedAt: new Date(100),
    };

    await service.screenshot(app as never);
    await service.screenshot({ ...app, lastStartedAt: new Date(200) } as never);
    await service.screenshot({ ...app, containerId: 'container-2' } as never);

    expect(network.prepareNetwork).toHaveBeenCalledTimes(3);
    expect(network.prepareScrcpyAdbTarget).toHaveBeenCalledTimes(3);
  });
});

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
        prepareNetwork,
        resolveScrcpyAdbHost: async () => '10.0.0.2',
        prepareScrcpyAdbTarget: async () => ({
          configured: true,
          connected: true,
        }),
      } as never,
    );

  afterEach(() => jest.restoreAllMocks());

  it.each(['wait', 'tap'] as const)(
    'times out during target preparation for %s without sending a late request',
    async (operation) => {
      const prepare = deferred<void>();
      const service = createService(() => prepare.promise);
      const fetch = jest.spyOn(globalThis, 'fetch');
      const keepAlive = setTimeout(() => {}, 500);
      try {
        await expect(
          service.uiText(app as never, { ...input, operation }),
        ).rejects.toMatchObject({
          name: 'TimeoutError',
        });
        prepare.resolve();
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(fetch).not.toHaveBeenCalled();
      } finally {
        clearTimeout(keepAlive);
      }
    },
  );

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
