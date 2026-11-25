import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApplicationRuntimeSnapshotDto } from '../dto/application-runtime-snapshot.dto';
import { AndroidAppsRuntimeSnapshotService } from '../services/android-apps-runtime-snapshot.service';

const ownerHeader = 'x-rebroid-snapshot-owner';

@ApiTags('app-runtime')
@Controller('devices')
export class AndroidAppsRuntimeSnapshotController {
  constructor(private readonly snapshots: AndroidAppsRuntimeSnapshotService) {}

  @Get(':id/runtime/snapshot')
  @ApiOperation({
    summary: 'Read the latest thumbnail for an owned running application.',
  })
  @ApiHeader({
    name: ownerHeader,
    required: true,
    description:
      'Authenticated account ID supplied by the trusted web service.',
  })
  @ApiOkResponse({ type: ApplicationRuntimeSnapshotDto })
  @ApiNotFoundResponse({
    description: 'The application snapshot is unavailable.',
  })
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers(ownerHeader) owner: unknown,
  ) {
    if (
      typeof owner !== 'string' ||
      !owner.trim() ||
      owner.length > 200 ||
      owner.includes(',')
    ) {
      throw new BadRequestException('Invalid snapshot owner.');
    }
    return this.snapshots.read(id, owner);
  }
}
