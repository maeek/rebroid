import type { AndroidApplication } from '../android-application.entity';
import type { UpdateNetworkPolicyDto } from '../network/dto/update-network-policy.dto';
import type { DisplaySessionDto } from '../viewer/dto/scrcpy-session.dto';
import type { ApplicationViewerControlCommand } from './application-viewer-control';
import type { ApplicationProfileMode } from './application-profile-mode';
import type { parseAndroidNotifications } from '../runtime/utils/android-apps-notification.utils';

export const ANDROID_APPS_AUTOMATION = Symbol('ANDROID_APPS_AUTOMATION');

export type AndroidAutomationApplication = AndroidApplication;

export interface AndroidAutomationAdbPort {
  getClipboard(
    app: AndroidApplication,
  ): Promise<{ text: string; supported: boolean }>;
  setClipboard(
    app: AndroidApplication,
    text: string,
  ): Promise<{ text: string; supported: boolean }>;
  tap(
    app: AndroidApplication,
    x: number,
    y: number,
  ): Promise<{ executed: boolean }>;
  swipe(
    app: AndroidApplication,
    input: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs: number;
    },
  ): Promise<{ executed: boolean }>;
  inputText(
    app: AndroidApplication,
    text: string,
  ): Promise<{ executed: boolean }>;
  key(app: AndroidApplication, key: string): Promise<{ executed: boolean }>;
  rotateDisplay(
    app: AndroidApplication,
    orientation:
      | 'portrait'
      | 'landscape'
      | 'reverse-portrait'
      | 'reverse-landscape',
  ): Promise<{ executed: boolean }>;
  shell(
    app: AndroidApplication,
    command: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  dumpUi(app: AndroidApplication): Promise<{
    status: 'available' | 'failed';
    xml?: string;
    error?: string;
    dumpedAt: string;
    diagnostics?: AndroidAutomationUiDumpAttempt;
    attempts?: AndroidAutomationUiDumpAttempt[];
  }>;
  tapText(
    app: AndroidApplication,
    text: string,
  ): Promise<{ found: boolean; x: number | null; y: number | null }>;
  pushFile(
    app: AndroidApplication,
    path: string,
    contentBase64: string,
  ): Promise<{ pushed: boolean }>;
  pullFile(
    app: AndroidApplication,
    path: string,
  ): Promise<{ path: string; contentBase64: string; sizeBytes: number }>;
  deleteFile(
    app: AndroidApplication,
    path: string,
  ): Promise<{ deleted: boolean }>;
  fileExists(app: AndroidApplication, path: string): Promise<boolean>;
  listFiles(app: AndroidApplication, path: string): Promise<string[]>;
  logcat(
    app: AndroidApplication,
    tail: number,
  ): Promise<{ source: 'adb'; collectedAt: string; output: string }>;
  notifications(
    app: AndroidApplication,
  ): Promise<ReturnType<typeof parseAndroidNotifications>>;
  screenshot(
    app: AndroidApplication,
  ): Promise<{ mimeType: string; dataUrl: string; capturedAt: string }>;
}

export interface AndroidAutomationUiDumpAttempt {
  command: string;
  compressed: boolean;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  xmlBytes: number;
  rawNodeCount: number;
}

export interface AndroidAutomationDisplayPort {
  createSessionForPreparedTarget(
    app: AndroidApplication,
    udid: string,
    capabilities?: string[],
  ): Promise<DisplaySessionDto>;
  tryCreateSessionForPreparedTarget(
    app: AndroidApplication,
    udid: string,
    capabilities?: string[],
  ): Promise<DisplaySessionDto | null>;
  viewerControl(
    app: AndroidApplication,
    command: ApplicationViewerControlCommand,
  ): Promise<{
    session: DisplaySessionDto;
    command: ApplicationViewerControlCommand;
    executed: boolean;
  }>;
  setClipboard(
    app: AndroidApplication,
    text: string,
  ): Promise<{ session: DisplaySessionDto; text: string; supported: boolean }>;
  releaseSessionsForApp(appId: string): Promise<void>;
  createVirtualSurface(
    app: AndroidApplication,
    input?: { name?: string; width?: number; height?: number; dpi?: number },
  ): Promise<DisplaySessionDto>;
  releaseVirtualSurface(
    app: AndroidApplication,
    surfaceId: string,
  ): Promise<DisplaySessionDto>;
  startRecording(
    app: AndroidApplication,
    surfaceId: string,
  ): Promise<AndroidAutomationDisplayRecording>;
  stopRecording(
    app: AndroidApplication,
    surfaceId: string,
  ): Promise<AndroidAutomationDisplayRecording>;
  downloadRecording(
    app: AndroidApplication,
    surfaceId: string,
    recordingId: string,
  ): Promise<{
    recording: AndroidAutomationDisplayRecording;
    response: Response;
  }>;
}

export interface AndroidAutomationDisplayRecording {
  id: string;
  sessionId: string;
  status: 'recording' | 'stopped';
  startedAt: string;
  stoppedAt: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  sampleCount: number;
  downloadPath: string | null;
}

export interface AndroidAutomationNetworkPolicyPort {
  updateNetworkPolicy(
    id: string,
    dto: UpdateNetworkPolicyDto,
  ): Promise<AndroidApplication>;
}

export interface AndroidAutomationAdapters {
  adb: AndroidAutomationAdbPort;
  display: AndroidAutomationDisplayPort;
  networkPolicy: AndroidAutomationNetworkPolicyPort;
}

export interface AndroidAppsAutomationPort {
  get(id: string): Promise<AndroidApplication>;
  start(
    id: string,
    dto?: { profileMode?: ApplicationProfileMode; profileName?: string },
  ): Promise<AndroidApplication>;
  automationAdapters(): AndroidAutomationAdapters;
}
