import { PassThrough } from 'node:stream';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { AndroidAppsRuntimeOperationGate } from '../../common/services/android-apps-runtime-operation-gate.service';
import { RuntimeDownloadFilesService } from './runtime-download-files.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

const fileHeader =
  '--boundary\r\nContent-Disposition: form-data; name="file"; filename="notes.txt"\r\n\r\n';
const fileEnd = '\r\n--boundary--\r\n';

function fixture() {
  const app = {
    id: 'one',
    status: AndroidApplicationStatus.Stopped,
    profileMode: ApplicationProfileMode.Persistent,
    profileName: 'work',
  };
  const storeStream = jest.fn();
  const operations = new AndroidAppsRuntimeOperationGate(
    {} as never,
    {} as never,
  );
  const service = new RuntimeDownloadFilesService(
    {} as never,
    {} as never,
    {} as never,
    { reconcileById: async () => app } as never,
    {} as never,
    { storeStream } as never,
    new RuntimeUploadStreamService(),
    operations,
  );
  const request = Object.assign(new PassThrough(), {
    headers: { 'content-type': 'multipart/form-data; boundary=boundary' },
  });
  return { app, operations, request, service, storeStream };
}

it.each([AndroidApplicationStatus.Removing, AndroidApplicationStatus.Removed])(
  'rejects a late upload when the application is %s before accessing its volume',
  async (status) => {
    const { app, request, service, storeStream } = fixture();
    app.status = status;
    const uploading = service.uploadDownloadFile(app.id, request);
    request.end(fileHeader + 'hello' + fileEnd);
    await expect(uploading).rejects.toMatchObject({ status: 409 });
    expect(storeStream).not.toHaveBeenCalled();
  },
);

it('drains admitted profile writes before removal can clean storage', async () => {
  const { app, operations, request, service, storeStream } = fixture();
  let start!: () => void;
  let finish!: () => void;
  const entered = new Promise<void>((resolve) => {
    start = resolve;
  });
  const cleanup = new Promise<void>((resolve) => {
    finish = resolve;
  });
  storeStream.mockImplementation(async () => {
    start();
    await cleanup;
  });
  const uploading = service.uploadDownloadFile(app.id, request);
  request.write(fileHeader + 'hello');
  await entered;
  const remove = jest.fn();
  const result = expect(uploading).rejects.toThrow(
    'File upload was cancelled.',
  );
  const removing = operations.interrupt(app.id, remove);
  try {
    await Promise.resolve();
    expect(remove).not.toHaveBeenCalled();
  } finally {
    finish();
    request.end(fileEnd);
    await Promise.all([result, removing]);
  }
  expect(remove).toHaveBeenCalledTimes(1);
});

it('interrupts a slow request before the first file without waiting for the client', async () => {
  const { app, request, service, storeStream, operations } = fixture();
  const uploading = service.uploadDownloadFile(app.id, request);
  const result = expect(uploading).rejects.toThrow(
    'File upload was cancelled.',
  );
  await operations.interrupt(app.id, async () => undefined);
  await result;
  request.end(fileHeader + 'late' + fileEnd);
  expect(storeStream).not.toHaveBeenCalled();
});
