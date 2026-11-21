import { ContainerImageGappsSourceService } from './container-image-gapps-source.service';

const service = new ContainerImageGappsSourceService();
afterEach(() => jest.restoreAllMocks());

it('cancels a pending source lookup with the build', async () => {
  const controller = new AbortController();
  jest.spyOn(global, 'fetch').mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      }),
  );

  const lookup = service.resolveRevision('fixture', controller.signal);
  const reason = new Error('Build cancelled');
  controller.abort(reason);
  await expect(lookup).rejects.toBe(reason);
});

it('releases the unused response body when a source lookup fails', async () => {
  const cancel = jest.fn();
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(
      new Response(new ReadableStream({ cancel }), { status: 404 }),
    );

  await expect(
    service.resolveRevision('fixture', new AbortController().signal),
  ).rejects.toThrow('HTTP 404');
  expect(cancel).toHaveBeenCalledTimes(1);
});
