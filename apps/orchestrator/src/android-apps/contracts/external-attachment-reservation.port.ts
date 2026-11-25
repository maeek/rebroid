import type { EntityManager } from 'typeorm';

export const EXTERNAL_ATTACHMENT_RESERVATION = Symbol(
  'EXTERNAL_ATTACHMENT_RESERVATION',
);

export interface ExternalAttachmentReservationPort {
  readOwnedAttachmentId(
    transaction: EntityManager,
    deviceId: string,
    ownerUserId: string,
  ): Promise<string | null>;
}
