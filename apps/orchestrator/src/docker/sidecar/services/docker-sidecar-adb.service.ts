import { Injectable, Logger } from '@nestjs/common';
import { DockerContainerExecService } from '../../containers/services/docker-container-exec.service';
import { DockerEngineService } from '../../docker-engine.service';
import {
  ContainerCommandFailure,
  ContainerCommandFailedException,
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

      const connectCommand = [
        'sh',
        '-lc',
        [
          `timeout 5s adb disconnect ${this.shellQuote(target)} >/dev/null 2>&1 || true`,
          `timeout 10s adb connect ${this.shellQuote(target)}`,
        ].join('; '),
      ];
      const output = await this.exec.execInContainerWithOutput(
        sidecarId,
        [...connectCommand],
        { timeoutMs: 20_000 },
      );
      const connectFailure = this.viewerTargetErrorFromOutput({
        command: connectCommand,
        stdout: output.stdout,
        stderr: output.stderr,
      });
      if (connectFailure) {
        return {
          configured: true,
          connected: false,
          message: connectFailure.message,
          error: connectFailure,
        };
      }

      const stateCommand = [
        'sh',
        '-lc',
        `timeout 10s adb -s ${this.shellQuote(target)} get-state 2>&1 || true`,
      ];
      const state = await this.exec.execInContainerWithOutput(
        sidecarId,
        [...stateCommand],
        { timeoutMs: 15_000 },
      );
      let currentState = state.stdout.trim().toLowerCase();
      let lastStateCommand = stateCommand;
      let lastState = state;

      if (currentState.includes('offline')) {
        const recoveryCommand = [
          'sh',
          '-lc',
          [
            `timeout 5s adb disconnect ${this.shellQuote(target)} >/dev/null 2>&1 || true`,
            'timeout 5s adb reconnect offline >/dev/null 2>&1 || true',
            'timeout 5s adb kill-server >/dev/null 2>&1 || true',
            'timeout 5s adb start-server >/dev/null 2>&1 || true',
            `timeout 10s adb connect ${this.shellQuote(target)}`,
            `timeout 30s adb -s ${this.shellQuote(target)} wait-for-device`,
            `timeout 10s adb -s ${this.shellQuote(target)} get-state 2>&1 || true`,
          ].join('; '),
        ];
        lastStateCommand = recoveryCommand;
        lastState = await this.exec.execInContainerWithOutput(
          sidecarId,
          recoveryCommand,
          { timeoutMs: 45_000 },
        );
        const stateTokens = lastState.stdout.trim().toLowerCase().split(/\s+/);
        currentState = stateTokens[stateTokens.length - 1] ?? '';
      }

      if (currentState !== 'device') {
        const viewerError = this.viewerTargetErrorFromOutput({
          command: lastStateCommand,
          stdout: lastState.stdout,
          stderr: lastState.stderr,
          fallbackMessage: `ADB target ${target} is not ready: ${lastState.stdout.trim() || 'unknown state'}.`,
        }) ?? {
          code: 'adb_unreachable' as const,
          message: `ADB target ${target} is not ready.`,
          retryable: true,
          exitCode: 0,
          command: lastStateCommand,
          stdout: lastState.stdout,
          stderr: lastState.stderr,
        };
        return {
          configured: true,
          connected: false,
          message: viewerError.message,
          error: viewerError,
        };
      }

      await this.prepareAndroidDisplay(sidecarId, target);

      return {
        configured: true,
        connected: true,
        message: [output.stdout, output.stderr, state.stdout]
          .filter(Boolean)
          .join('\n'),
        error: null,
      };
    } catch (error) {
      const viewerError = this.viewerTargetError(error);
      this.logger.warn(
        `Unable to prepare display sidecar ADB target ${adbHost}:${adbPort}: ${viewerError.message}`,
      );
      return {
        configured: true,
        connected: false,
        message: viewerError.message,
        error: viewerError,
      };
    }
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

  private viewerTargetErrorFromOutput({
    command,
    stdout,
    stderr,
    fallbackMessage,
  }: {
    command: string[];
    stdout: string;
    stderr: string;
    fallbackMessage?: string;
  }): ViewerTargetError | null {
    const combinedOutput = [stderr, stdout].filter(Boolean).join('\n');

    if (!isTransientAdbConnectionError(combinedOutput)) {
      if (!fallbackMessage) {
        return null;
      }

      return {
        code: 'adb_unreachable',
        message: fallbackMessage,
        retryable: true,
        exitCode: 0,
        command,
        stdout,
        stderr,
      };
    }

    return {
      code: 'adb_unreachable',
      message:
        combinedOutput.trim() ||
        fallbackMessage ||
        'ADB target is not reachable.',
      retryable: true,
      exitCode: 0,
      command,
      stdout,
      stderr,
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

    if (isTransientAdbConnectionError(combinedOutput)) {
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
