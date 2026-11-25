import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import { ExternalAdbBrokerClient } from './external-adb-broker.client';
import { ExternalAndroidDevicesService } from './external-android-devices.service';
import { ExternalDeviceViewerService } from './external-device-viewer.service';

describe('external attachment viewer admission', () => {
  const id = 'device';
  const owner = 'owner';
  const attachment = 'verified';
  const makeDevice = (attachmentId = attachment) => ({
    id,
    ownerUserId: owner,
    connection: { state: 'ready', attachmentId },
  });
  const get = jest.fn();
  const screenshot = jest.fn();
  const createViewer = jest.fn();
  const broker = {
    enabled: true,
    screenshot,
    createViewer,
    synchronizeViewerFeatures: jest.fn(),
  };
  const service = new ExternalDeviceViewerService(
    { get } as unknown as ExternalAndroidDevicesService,
    broker as unknown as ExternalAdbBrokerClient,
    {
      assertEnabled: jest.fn(),
      getManifest: () => ({ revision: 1, features: [] }),
    } as unknown as FeatureFlagsService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    get.mockResolvedValue(makeDevice());
    broker.synchronizeViewerFeatures.mockResolvedValue({ revision: 1 });
  });

  it('withholds output if the attachment is replaced during capture', async () => {
    get
      .mockResolvedValueOnce(makeDevice())
      .mockResolvedValueOnce(makeDevice('replacement'));
    screenshot.mockResolvedValue({ pngBase64: 'image' });
    await expect(
      service.tool(id, owner, attachment, 'screenshot'),
    ).rejects.toMatchObject({ status: 409 });
    expect(screenshot).toHaveBeenCalledWith(id, attachment);
    expect(get).toHaveBeenCalledWith(id, {
      userId: owner,
      administrator: false,
    });
  });

  it('rejects a stale viewer request before contacting the broker', async () => {
    get.mockResolvedValue(makeDevice('replacement'));
    await expect(
      service.open(id, owner, attachment, ['control']),
    ).rejects.toMatchObject({ status: 409 });
    expect(createViewer).not.toHaveBeenCalled();
  });

  it('keeps attachment grants owner-scoped for administrators', async () => {
    await expect(
      service.open(id, 'other-admin', attachment, ['control'], true),
    ).rejects.toMatchObject({ status: 404 });
    expect(createViewer).not.toHaveBeenCalled();
  });

  it('reports audio support from the admitted session capabilities', async () => {
    createViewer.mockResolvedValue({
      session: {
        id: 'session',
        viewerPath: '/viewer',
        capabilities: ['video', 'audio'],
      },
    });
    await expect(service.open(id, owner, attachment, [])).resolves.toEqual({
      id: 'session',
      viewerPath: '/viewer',
      audioSupported: true,
    });
    createViewer.mockResolvedValue({
      session: {
        id: 'session',
        viewerPath: '/viewer',
        capabilities: ['video'],
      },
    });
    await expect(
      service.open(id, owner, attachment, []),
    ).resolves.toMatchObject({ audioSupported: false });
  });
});
