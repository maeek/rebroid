import type { ApplicationViewerControlCommand } from './application-viewer-control';
import type { ApplicationProfileMode } from './application-profile-mode';
import type { AndroidApplicationStatus } from './android-application-status';

export const ANDROID_APPS_AUTOMATION = Symbol('ANDROID_APPS_AUTOMATION');

export interface ManagedAutomationApplication {
  id: string;
  kind?: 'managed';
  ownerUserId: string | null;
  status: AndroidApplicationStatus;
  statusMessage: string | null;
  profileMode: ApplicationProfileMode;
  profileName: string | null;
  containerId: string | null;
  containerName: string;
  networkName: string;
  adbPort: number;
  lastStartedAt: Date | null;
  networkPolicyEnabled: boolean;
  networkPolicyAllowCidrs: string;
}

export interface ExternalAutomationApplication {
  id: string;
  kind: 'external';
  ownerUserId: string;
  attachmentId: string | null;
}

export type AndroidAutomationApplication =
  ManagedAutomationApplication | ExternalAutomationApplication;

export interface ManagedAutomationTarget extends ManagedAutomationApplication {
  readonly containerStartedAt: string;
}

export type AndroidAutomationTarget =
  | ManagedAutomationTarget
  | (ExternalAutomationApplication & { attachmentId: string });

export interface AndroidAutomationDisplaySession {
  id: string;
  surfaceId: string;
}

export interface AndroidAutomationNetworkPolicyUpdate {
  networkPolicyEnabled?: boolean;
  networkPolicyAllowCidrs?: string[];
}

export interface AndroidAutomationCidrChange {
  operation: 'add' | 'remove';
  cidr: string;
}

export interface AndroidAutomationAdbPort {
  launchPackage?(
    app: AndroidAutomationApplication,
    packageName: string,
    signal?: AbortSignal,
  ): Promise<{ installed: boolean; launched: boolean }>;
  getClipboard(
    app: AndroidAutomationApplication,
    signal?: AbortSignal,
  ): Promise<{ text: string; supported: boolean }>;
  setClipboard(
    app: AndroidAutomationApplication,
    text: string,
    signal?: AbortSignal,
  ): Promise<{ text: string; supported: boolean }>;
  tap(
    app: AndroidAutomationApplication,
    x: number,
    y: number,
    signal?: AbortSignal,
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
    signal?: AbortSignal,
  ): Promise<{ executed: boolean }>;
  inputText(
    app: AndroidAutomationApplication,
    text: string,
    signal?: AbortSignal,
  ): Promise<{ executed: boolean }>;
  key(
    app: AndroidAutomationApplication,
    key: string,
    signal?: AbortSignal,
  ): Promise<{ executed: boolean }>;
  rotateDisplay(
    app: AndroidAutomationApplication,
    orientation:
      'portrait' | 'landscape' | 'reverse-portrait' | 'reverse-landscape',
    signal?: AbortSignal,
  ): Promise<{ executed: boolean }>;
  shell(
    app: AndroidAutomationApplication,
    command: string,
    timeoutMs: number,
    signal?: AbortSignal,
    deadline?: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  dumpUi(
    app: AndroidAutomationApplication,
    signal?: AbortSignal,
  ): Promise<{
    status: 'available' | 'failed';
    xml?: string;
    error?: string;
    dumpedAt: string;
    diagnostics?: AndroidAutomationUiDumpAttempt;
    attempts?: AndroidAutomationUiDumpAttempt[];
  }>;
  uiText(
    app: AndroidAutomationApplication,
    input: AndroidAutomationUiTextInput,
    signal?: AbortSignal,
  ): Promise<AndroidAutomationUiTextResult>;
  pushFile(
    app: AndroidAutomationApplication,
    path: string,
    contentBase64: string,
    signal?: AbortSignal,
  ): Promise<{ pushed: boolean }>;
  pullFile(
    app: AndroidAutomationApplication,
    path: string,
    signal?: AbortSignal,
  ): Promise<{ path: string; contentBase64: string; sizeBytes: number }>;
  deleteFile(
    app: AndroidAutomationApplication,
    path: string,
    signal?: AbortSignal,
  ): Promise<{ deleted: boolean }>;
  fileExists(
    app: AndroidAutomationApplication,
    path: string,
    signal?: AbortSignal,
  ): Promise<boolean>;
  listFiles(
    app: AndroidAutomationApplication,
    path: string,
    signal?: AbortSignal,
  ): Promise<string[]>;
  screenshot(
    app: AndroidAutomationApplication,
    signal?: AbortSignal,
  ): Promise<{ mimeType: string; dataUrl: string; capturedAt: string }>;
}

export interface AndroidAutomationUiTextInput {
  text: string;
  match: 'exact' | 'contains';
  operation: 'wait' | 'tap';
  timeoutMs: number;
  intervalMs: number;
}

export type AndroidAutomationUiTextResult =
  | { status: 'found'; x: number; y: number }
  | { status: 'not_found' | 'hierarchy_unavailable' | 'tap_outcome_unknown' };

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
  viewerControl(
    app: AndroidAutomationApplication,
    command: ApplicationViewerControlCommand,
    signal?: AbortSignal,
  ): Promise<{
    session: AndroidAutomationDisplaySession;
    command: ApplicationViewerControlCommand;
    executed: boolean;
  }>;
}

export interface AndroidAutomationNetworkPolicyPort {
  updateNetworkPolicy(
    id: string,
    input: AndroidAutomationNetworkPolicyUpdate,
  ): Promise<ManagedAutomationApplication>;
  changeAllowedCidr(
    id: string,
    change: AndroidAutomationCidrChange,
  ): Promise<ManagedAutomationApplication>;
}

export interface AndroidAutomationAdapters {
  adb: AndroidAutomationAdbPort;
  display: AndroidAutomationDisplayPort;
  networkPolicy: AndroidAutomationNetworkPolicyPort;
}

export interface AndroidAppsAutomationPort {
  get(id: string): Promise<ManagedAutomationApplication>;
  getAutomationDevice?(id: string): Promise<AndroidAutomationApplication>;
  start(
    id: string,
    dto?: { profileMode?: ApplicationProfileMode; profileName?: string },
    maxOpenApps?: number,
  ): Promise<ManagedAutomationApplication>;
  captureAutomationTarget(
    app: AndroidAutomationApplication,
    signal: AbortSignal,
  ): Promise<AndroidAutomationTarget>;
  withAutomationTarget<T>(
    expected: AndroidAutomationTarget,
    signal: AbortSignal | undefined,
    operation: (app: AndroidAutomationApplication) => Promise<T>,
  ): Promise<T>;
  automationAdapters(
    canUseInternet: boolean,
    device?: AndroidAutomationApplication,
  ): AndroidAutomationAdapters;
}
