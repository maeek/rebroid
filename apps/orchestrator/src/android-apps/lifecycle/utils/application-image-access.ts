import { ForbiddenException } from '@nestjs/common';

export const applicationImageAccessValues = [
  'none',
  'redroid',
  'custom',
  'all',
  'admin',
] as const;
export type ApplicationImageAccess =
  (typeof applicationImageAccessValues)[number];

export const assertApplicationImageAccess = (
  image: string,
  access: ApplicationImageAccess,
  privileged: boolean,
) => {
  if (access === 'admin') return;
  // Runtime detection also accepts third-party derivatives. Match the publisher here.
  const trusted =
    /^((docker\.io|index\.docker\.io)\/)?redroid\/redroid(?=[:@]|$)/i.test(
      image,
    );
  if (
    (!trusted && privileged) ||
    (access !== 'all' && access !== (trusted ? 'redroid' : 'custom'))
  ) {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'application_image_forbidden',
      message: 'You do not have permission to use this runtime image.',
    });
  }
};
