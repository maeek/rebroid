import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import type { FastifyBaseLogger } from 'fastify';

const pinoLevels = {
  verbose: 'trace',
  debug: 'debug',
  log: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'fatal',
} as const satisfies Record<LogLevel, keyof FastifyBaseLogger>;

export class PinoNestLogger extends ConsoleLogger {
  private readonly logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    // Nest enables debug and verbose by default. Keep Fastify at its HTTP log level.
    super({ json: true });
    this.logger = logger.child({}, { level: 'trace' });
  }

  protected override printAsJson(
    message: unknown,
    {
      context,
      logLevel,
      errorStack,
    }: { context: string; logLevel: LogLevel; errorStack?: unknown },
  ) {
    const write = this.logger[pinoLevels[logLevel]].bind(this.logger);
    const metadata = { context: context || undefined, stack: errorStack };
    if (typeof message === 'string') {
      write(metadata, message);
    } else if (message instanceof Error) {
      write({ ...metadata, err: message }, message.message);
    } else if (
      message &&
      typeof message === 'object' &&
      !Array.isArray(message)
    ) {
      write({ ...message, ...metadata });
    } else {
      write({ ...metadata, message });
    }
  }
}
