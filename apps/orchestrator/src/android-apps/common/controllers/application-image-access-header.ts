import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import {
  applicationImageAccessValues,
  type ApplicationImageAccess,
} from '../../lifecycle/utils/application-image-access';

const headerName = 'x-rebroid-image-access';

export const ApiImageAccess = () =>
  ApiHeader({
    name: headerName,
    required: false,
    description: 'Image permissions supplied by the trusted web service.',
    schema: { type: 'string', enum: [...applicationImageAccessValues] },
  });

export const ImageAccess = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApplicationImageAccess => {
    const value = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
    }>().headers[headerName];
    if (value === undefined) return 'admin';
    const access = applicationImageAccessValues.find(
      (candidate) => candidate === value,
    );
    if (!access)
      throw new BadRequestException('Invalid application image access.');
    return access;
  },
);
