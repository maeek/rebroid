import { PassThrough } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { DockerContainerArchiveService } from './docker-container-archive.service';

it('aborts and joins the Docker upload when the file stream fails', async () => {
  const source = new PassThrough();
  const fileError = new Error('File read failed');
  let rejectUpload!: (error: Error) => void;
  let requestSignal: AbortSignal | undefined;
  const putArchive = jest.fn(
    (archive: PassThrough, options: { abortSignal: AbortSignal }) => {
      archive.resume();
      requestSignal = options.abortSignal;
      return new Promise<void>((_, reject) => {
        rejectUpload = reject;
      });
    },
  );
  const service = new DockerContainerArchiveService({
    longOperation: (
      _kind: string,
      _description: string,
      execute: (
        docker: { getContainer: () => { putArchive: typeof putArchive } },
        signal: AbortSignal,
      ) => Promise<unknown>,
    ) =>
      execute(
        { getContainer: () => ({ putArchive }) },
        new AbortController().signal,
      ),
  } as never);

  const transfer = service.copyStreamToContainer(
    'container',
    source,
    '/sdcard',
    'file',
    10,
  );
  const result = jest.fn();
  void transfer.then(result, result);
  try {
    await setImmediate();
    source.destroy(fileError);
    await setImmediate();
    expect(requestSignal?.aborted).toBe(true);
    expect(result).not.toHaveBeenCalled();
  } finally {
    rejectUpload(new Error('Docker closed its request'));
  }
  await expect(transfer).rejects.toBe(fileError);
});
