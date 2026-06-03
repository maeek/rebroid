import { Injectable } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { hasDockerStatusCode } from '../../utils/docker-engine.utils';

@Injectable()
export class DockerErrorClassifier {
  isDockerConflict(error: unknown) {
    return hasDockerStatusCode(error, 409);
  }

  isDockerForbidden(error: unknown) {
    return hasDockerStatusCode(error, 403);
  }

  isDockerNotFound(error: unknown) {
    return hasDockerStatusCode(error, 404);
  }

  isDockerNotModified(error: unknown) {
    return hasDockerStatusCode(error, 304);
  }

  isContainerAlreadyConnectedToNetwork(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('already connected') ||
      (message.includes('endpoint with name') &&
        message.includes('already exists') &&
        message.includes('network'))
    );
  }

  isContainerAlreadyDisconnectedFromNetwork(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('not connected') ||
      message.includes('no such container') ||
      message.includes('not found')
    );
  }

  isContainerRemovalInProgress(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('removal of container') &&
      message.includes('already in progress')
    );
  }

  isResourceAlreadyExists(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      this.isDockerConflict(error) ||
      this.isDockerForbidden(error) ||
      message.includes('already exists') ||
      message.includes('is already in use')
    );
  }

  isTransientDockerTransportError(error: unknown) {
    const code = this.errorCode(error);
    const message = this.errorMessage(error).toLowerCase();
    return (
      ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(code) ||
      message.includes('socket hang up') ||
      message.includes('connection reset') ||
      message.includes('broken pipe')
    );
  }

  errorMessage(error: unknown) {
    return getErrorMessage(error, 'Unknown Docker error');
  }

  sanitizeDockerError(message: string) {
    return message
      .replace(/\b[0-9a-f]{32,64}\b/gi, '<resource-id>')
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
        '<resource-id>',
      )
      .slice(0, 500);
  }

  errorCode(error: unknown) {
    return typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
      ? error.code
      : '';
  }
}
