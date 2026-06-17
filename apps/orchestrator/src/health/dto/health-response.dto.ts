import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceHealthDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty({ enum: ['healthy', 'unhealthy', 'offline', 'disabled'] })
  status!: 'healthy' | 'unhealthy' | 'offline' | 'disabled';

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  details?: Record<string, unknown>;
}

export class OrchestratorDiagnosticsServicesDto {
  @ApiProperty({ type: ServiceHealthDto })
  orchestrator!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  docker!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  runtime!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  display!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  firewall!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  ocr!: ServiceHealthDto;
}

export class OrchestratorDiagnosticsDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  docker!: boolean;

  @ApiProperty()
  runtime!: boolean;

  @ApiProperty()
  display!: boolean;

  @ApiProperty()
  firewall!: boolean;

  @ApiProperty()
  ocr!: boolean;

  @ApiProperty({ type: OrchestratorDiagnosticsServicesDto })
  services!: OrchestratorDiagnosticsServicesDto;
}
