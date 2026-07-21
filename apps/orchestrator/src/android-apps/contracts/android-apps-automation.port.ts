import type { ApplicationViewerControlCommand } from './application-viewer-control';
import type { ApplicationProfileMode } from './application-profile-mode';
import type { AndroidApplicationStatus } from './android-application-status';

export const ANDROID_APPS_AUTOMATION = Symbol('ANDROID_APPS_AUTOMATION');

export interface AndroidAutomationApplication {
  id: string;
  ownerUserId: string | null;
  status: AndroidApplicationStatus;
  statusMessage: string | null;
  profileMode: ApplicationProfileMode;
  profileName: string | null;
  containerId: string | null;
  containerName: string;
  networkName: string;
  adbPort: number;
  networkPolicyEnabled: boolean;
  networkPolicyAllowCidrs: string;
}

export interface AndroidAutomationDisplaySession {
  id: string;
  surfaceId: string;
}

export interface AndroidAutomationNotification {
  packageName: string;
  title: string;
  text: string;
  appName: string | null;
  raw: string;
}

export interface AndroidAutomationNetworkPolicyUpdate {
  networkPolicyEnabled?: boolean;
  networkPolicyAllowCidrs?: string[];
}

export interface AndroidAutomationAdbPort {
  getClipboard(
    app: AndroidAutomationApplication,
  ): Promise<{ text: string; supported: boolean }>;
  setClipboard(
    app: AndroidAutomationApplication,
    text: string,
  ): Promise<{ text: string; supported: boolean }>;
  tap(
    app: AndroidAutomationApplication,
    x: number,
    y: number,
  ): Promise<{ executed: boolean }>;
  swipe(
    app: AndroidAutomationApplication,
    input: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs: number;
    },
  ): Promise<{ executed: boolean }>;
  inputText(
    app: AndroidAutomationApplication,
    text: string,
  ): Promise<{ executed: boolean }>;
  key(
    app: AndroidAutomationApplication,
    key: string,
  ): Promise<{ executed: boolean }>;
  rotateDisplay(
    app: AndroidAutomationApplication,
    orientation:
      | 'portrait'
      | 'landscape'
      | 'reverse-portrait'
      | 'reverse-landscape',
  ): Promise<{ executed: boolean }>;
  shell(
    app: AndroidAutomationApplication,
    command: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  dumpUi(app: AndroidAutomationApplication): Promise<{
    status: 'available' | 'failed';
    xml?: string;
    error?: string;
    dumpedAt: string;
    diagnostics?: AndroidAutomationUiDumpAttempt;
    attempts?: AndroidAutomationUiDumpAttempt[];
  }>;
  tapText(
    app: AndroidAutomationApplication,
    text: string,
  ): Promise<{ found: boolean; x: number | null; y: number | null }>;
  pushFile(
    app: AndroidAutomationApplication,
    path: string,
    contentBase64: string,
  ): Promise<{ pushed: boolean }>;
  pullFile(
    app: AndroidAutomationApplication,
    path: string,
  ): Promise<{ path: string; contentBase64: string; sizeBytes: number }>;
  deleteFile(
    app: AndroidAutomationApplication,
    path: string,
  ): Promise<{ deleted: boolean }>;
  fileExists(app: AndroidAutomationApplication, path: string): Promise<boolean>;
  listFiles(app: AndroidAutomationApplication, path: string): Promise<string[]>;
  logcat(
    app: AndroidAutomationApplication,
    tail: number,
  ): Promise<{ source: 'adb'; collectedAt: string; output: string }>;
  notifications(
    app: AndroidAutomationApplication,
  ): Promise<AndroidAutomationNotification[]>;
  screenshot(
    app: AndroidAutomationApplication,
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
    app: AndroidAutomationApplication,
    udid: string,
    capabilities?: string[],
  ): Promise<AndroidAutomationDisplaySession>;
  tryCreateSessionForPreparedTarget(
    app: AndroidAutomationApplication,
    udid: string,
    capabilities?: string[],
  ): Promise<AndroidAutomationDisplaySession | null>;
  viewerControl(
    app: AndroidAutomationApplication,
    command: ApplicationViewerControlCommand,
  ): Promise<{
    session: AndroidAutomationDisplaySession;
    command: ApplicationViewerControlCommand;
    executed: boolean;
  }>;
  setClipboard(
    app: AndroidAutomationApplication,
    text: string,
  ): Promise<{
    session: AndroidAutomationDisplaySession;
    text: string;
    supported: boolean;
  }>;
  releaseSessionsForApp(appId: string): Promise<void>;
  createVirtualSurface(
    app: AndroidAutomationApplication,
    input?: { name?: string; width?: number; height?: number; dpi?: number },
  ): Promise<AndroidAutomationDisplaySession>;
  releaseVirtualSurface(
    app: AndroidAutomationApplication,
    surfaceId: string,
  ): Promise<AndroidAutomationDisplaySession>;
}

export interface AndroidAutomationNetworkPolicyPort {
  updateNetworkPolicy(
    id: string,
    input: AndroidAutomationNetworkPolicyUpdate,
  ): Promise<AndroidAutomationApplication>;
}

export interface AndroidAutomationAdapters {
  adb: AndroidAutomationAdbPort;
  display: AndroidAutomationDisplayPort;
  networkPolicy: AndroidAutomationNetworkPolicyPort;
}

export interface AndroidAppsAutomationPort {
  get(id: string): Promise<AndroidAutomationApplication>;
  start(
    id: string,
    dto?: { profileMode?: ApplicationProfileMode; profileName?: string },
  ): Promise<AndroidAutomationApplication>;
  automationAdapters(): AndroidAutomationAdapters;
}
