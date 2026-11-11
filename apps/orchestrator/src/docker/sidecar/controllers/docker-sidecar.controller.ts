import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ServiceHealthDto } from '../../../health/dto/health-response.dto';
import {
  DockerSidecarAdminSessionDto,
  DockerSidecarLogTailDto,
} from '../dto/docker-sidecar-response.dto';
import {
  DockerSidecarSessionRevocationDto,
  RevokeDockerSidecarSessionsDto,
} from '../dto/docker-sidecar-revocation.dto';
import { DockerSidecarService } from '../services/docker-sidecar.service';

@ApiTags('platform-display-sidecar')
@Controller('platform/display-sidecar')
export class DockerSidecarController {
  constructor(private readonly sidecar: DockerSidecarService) {}

  @Get('health')
  @ApiOperation({ summary: 'Read display sidecar health.' })
  @ApiOkResponse({ type: ServiceHealthDto })
  health() {
    return this.sidecar.health();
  }

  @Get('logs')
  @ApiOperation({
    summary: 'Read a bounded tail of the display sidecar container logs.',
  })
  @ApiQuery({ name: 'expanded', type: Boolean, required: false })
  @ApiOkResponse({ type: DockerSidecarLogTailDto })
  @ApiPayloadTooLargeResponse({
    description: 'The container log tail exceeds the read limit.',
  })
  logs(
    @Query('expanded', new DefaultValuePipe(false), ParseBoolPipe)
    expanded: unknown,
  ) {
    return this.sidecar.getLogs(expanded === true);
  }

  @Post('repair')
  @ApiOperation({ summary: 'Restart or create the display sidecar.' })
  @ApiOkResponse({ type: ServiceHealthDto })
  async repair() {
    await this.sidecar.repair();
    return this.sidecar.health();
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'List display sidecar sessions for administration.',
  })
  @ApiOkResponse({ type: [DockerSidecarAdminSessionDto] })
  listSessions() {
    return this.sidecar.listDisplaySessions();
  }

  @Post('sessions/revoke')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Revoke display sessions for the supplied accounts.',
  })
  @ApiOkResponse({ type: DockerSidecarSessionRevocationDto })
  revokeSessions(@Body() dto: RevokeDockerSidecarSessionsDto) {
    return this.sidecar.revokeDisplaySessions(dto.ownerUserIds);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Release one display sidecar session.' })
  @ApiOkResponse({ type: DockerSidecarAdminSessionDto })
  releaseSession(@Param('id') id: string) {
    return this.sidecar.releaseDisplaySession(id);
  }
}
