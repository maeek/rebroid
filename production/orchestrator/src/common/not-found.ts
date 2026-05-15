import { NotFoundException } from '@nestjs/common';

export const throwNotFound = (resource: string, id: string): never => {
  throw new NotFoundException(`${resource} "${id}" was not found`);
};
