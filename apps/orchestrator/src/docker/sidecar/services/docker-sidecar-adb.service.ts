import { Injectable, Logger } from '@nestjs/common';
import { DockerContainerExecService } from '../../containers/services/docker-container-exec.service';
import { DockerEngineService } from '../../docker-engine.service';
import {
  ContainerCommandFailure,
  ContainerCommandFailedException,
  ContainerCommandResult,
  ViewerTargetError,
  ViewerTargetStatus,
} from '../../docker.types';
import { isTransientAdbConnectionError } from '../utils/docker-sidecar.utils';

@Injectable()
export class DockerSidecarAdbService {
  private readonly logger = new Logger(DockerSidecarAdbService.name);

  constructor(
    private readonly engine: DockerEngineService,
    private readonly exec: DockerContainerExecService,
  ) {}

  async prepareTarget(
    sidecarId: string,
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetStatus> {
    try {
      const target = `${adbHost}:${adbPort}`;
      const tcpProbe = await this.probeTcpTarget(sidecarId, adbHost, adbPort);
      if (tcpProbe) {
        return {
          configured: true,
          connected: false,
          message: tcpProbe.message,
          error: tcpProbe,
        };
      }

      const connection = await this.connectTarget(sidecarId, target);
      if (!connection.connected) {
        return connection;
      }

      await this.prepareAndroidDisplay(sidecarId, target);
      return connection;
    } catch (error) {
      const viewerError = this.viewerTargetError(error);
      this.logger.warn(
        `Unable to prepare display sidecar ADB target ${adbHost}:${adbPort}: ${viewerError.message}`,
      );
      return this.targetFailure(viewerError);
    }
  }

  private async connectTarget(
    sidecarId: string,
    target: string,
  ): Promise<ViewerTargetStatus> {
    const quotedTarget = this.shellQuote(target);
    try {
      const connectCommand = [
        'sh',
        '-lc',
        [
          `timeout -k 1s 5s adb disconnect ${quotedTarget} >/dev/null 2>&1 || true`,
          `timeout -k 1s 10s adb connect ${quotedTarget}`,
        ].join('; '),
      ];
      const output = await this.exec.execInContainerWithOutput(
        sidecarId,
        connectCommand,
        { timeoutMs: 20_000 },
      );
      const connectOutput = [output.stdout, output.stderr]
        .filter(Boolean)
        .join('\n');
      if (connectOutput.toLowerCase().includes('offline')) {
        return this.reconnectTarget(sidecarId, target);
      }
      if (isTransientAdbConnectionError(connectOutput)) {
        return this.targetFailure({
          code: 'adb_unreachable',
          message: connectOutput.trim(),
          retryable: true,
          exitCode: output.exitCode,
          command: connectCommand,
          stdout: output.stdout,
          stderr: output.stderr,
        });
      }

      const stateCommand = [
        'sh',
        '-lc',
        `timeout -k 1s 10s adb -s ${quotedTarget} get-state 2>&1`,
      ];
      const state = await this.exec.execInContainerWithOutput(
        sidecarId,
        stateCommand,
        { timeoutMs: 15_000 },
      );
      if (state.stdout.toLowerCase().includes('offline')) {
        return this.reconnectTarget(sidecarId, target);
      }

      return this.targetState(target, stateCommand, state, connectOutput);
    } catch (error) {
      if (error instanceof ContainerCommandFailedException) {
        const { exitCode, stdout, stderr } = error.details;
        if (
          exitCode === 124 ||
          exitCode === 137 ||
          [stdout, stderr].some((output) =>
            output?.toLowerCase().includes('offline'),
          )
        ) {
          return this.reconnectTarget(sidecarId, target);
        }
      }
      throw error;
    }
  }

  private async reconnectTarget(sidecarId: string, target: string) {
    const quotedTarget = this.shellQuote(target);
    const command = [
      'sh',
      '-lc',
      [
        `timeout -k 1s 5s adb disconnect ${quotedTarget} >/dev/null 2>&1 || true;`,
        `timeout -k 1s 10s adb connect ${quotedTarget} &&`,
        `timeout -k 1s 10s adb -s ${quotedTarget} wait-for-device &&`,
        `timeout -k 1s 5s adb -s ${quotedTarget} get-state`,
      ].join(' '),
    ];
    // A shared ADB daemon restart would drop other applications' transports.
    const state = await this.exec.execInContainerWithOutput(
      sidecarId,
      command,
      {
        timeoutMs: 40_000,
      },
    );
    return this.targetState(target, command, state);
  }

  private targetState(
    target: string,
    command: string[],
    state: ContainerCommandResult,
    connectOutput?: string,
  ): ViewerTargetStatus {
    if (
      state.stdout.trim().split('\n').at(-1)?.trim().toLowerCase() !== 'device'
    ) {
      return this.targetFailure({
        code: 'adb_unreachable',
        message: `ADB target ${target} is not ready: ${state.stdout.trim() || 'unknown state'}.`,
        retryable: true,
        exitCode: state.exitCode,
        command,
        stdout: state.stdout,
        stderr: state.stderr,
      });
    }

    return {
      configured: true,
      connected: true,
      message: [connectOutput, state.stdout].filter(Boolean).join('\n'),
      error: null,
    };
  }

  private targetFailure(error: ViewerTargetError): ViewerTargetStatus {
    return {
      configured: true,
      connected: false,
      message: error.message,
      error,
    };
  }

  private async prepareAndroidDisplay(
    sidecarId: string,
    target: string,
  ): Promise<void> {
    const command = [
      'sh',
      '-lc',
      [
        `timeout 10s adb -s ${this.shellQuote(target)} shell ${this.shellQuote(
          [
            'settings put system screen_off_timeout 2147483647 >/dev/null 2>&1 || true',
            'svc power stayon true >/dev/null 2>&1 || true',
            'input keyevent WAKEUP >/dev/null 2>&1 || input keyevent 224 >/dev/null 2>&1 || true',
            'wm dismiss-keyguard >/dev/null 2>&1 || input keyevent MENU >/dev/null 2>&1 || true',
          ].join('; '),
        )}`,
      ].join(' && '),
    ];

    try {
      await this.exec.execInContainerWithOutput(sidecarId, command, {
        timeoutMs: 15_000,
      });
    } catch (error) {
      const viewerError = this.viewerTargetError(error);
      this.logger.warn(
        `Unable to prepare Android display for ${target}: ${viewerError.message}`,
      );
    }
  }

  private async probeTcpTarget(
    sidecarId: string,
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetError | null> {
    const hostLiteral = JSON.stringify(adbHost);
    const portLiteral = JSON.stringify(adbPort);
    const probeCommand = [
      'sh',
      '-lc',
      [
        'node -e',
        this.shellQuote(
          [
            'const net = require("node:net");',
            `const host = ${hostLiteral};`,
            `const port = ${portLiteral};`,
            'const socket = net.createConnection({ host, port });',
            'socket.setTimeout(3000);',
            'socket.on("connect", () => {',
            '  process.stdout.write(`tcp:${host}:${port} reachable`);',
            '  socket.end();',
            '});',
            'socket.on("timeout", () => {',
            '  process.stderr.write(`tcp probe timed out for ${host}:${port}`);',
            '  socket.destroy();',
            '  process.exit(124);',
            '});',
            'socket.on("error", (error) => {',
            '  process.stderr.write(`tcp probe failed for ${host}:${port}: ${error.message}`);',
            '  process.exit(1);',
            '});',
          ].join(' '),
        ),
      ].join(' '),
    ];

    try {
      await this.exec.execInContainerWithOutput(sidecarId, probeCommand, {
        timeoutMs: 5_000,
      });
      return null;
    } catch (error) {
      const viewerError = this.viewerTargetError(error);
      return {
        code: 'adb_unreachable',
        message:
          viewerError.stderr?.trim() ||
          viewerError.stdout?.trim() ||
          `TCP probe to ${adbHost}:${adbPort} failed before adb connect.`,
        retryable: true,
        exitCode: viewerError.exitCode,
        command: probeCommand,
        stdout: viewerError.stdout,
        stderr: viewerError.stderr,
      };
    }
  }

  private viewerTargetError(error: unknown): ViewerTargetError {
    if (error instanceof ContainerCommandFailedException) {
      return this.classifyViewerTargetError(error.details);
    }

    const message = this.engine.errorMessage(error);
    return {
      code: 'unknown',
      message,
      retryable: false,
      exitCode: null,
      command: null,
      stdout: null,
      stderr: null,
    };
  }

  private classifyViewerTargetError(
    details: ContainerCommandFailure,
  ): ViewerTargetError {
    const combinedOutput = [details.stderr, details.stdout]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();

    if (
      details.exitCode === 127 &&
      combinedOutput.includes('adb') &&
      combinedOutput.includes('not found')
    ) {
      return {
        code: 'adb_missing',
        message: details.message,
        retryable: false,
        exitCode: details.exitCode,
        command: details.command,
        stdout: details.stdout,
        stderr: details.stderr,
      };
    }

    if (
      details.exitCode === 124 ||
      details.exitCode === 137 ||
      /device .* not found/.test(combinedOutput) ||
      isTransientAdbConnectionError(combinedOutput)
    ) {
      return {
        code: 'adb_unreachable',
        message: details.message,
        retryable: true,
        exitCode: details.exitCode,
        command: details.command,
        stdout: details.stdout,
        stderr: details.stderr,
      };
    }

    return {
      code: 'unknown',
      message: details.message,
      retryable: false,
      exitCode: details.exitCode,
      command: details.command,
      stdout: details.stdout,
      stderr: details.stderr,
    };
  }

  private shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }
}
