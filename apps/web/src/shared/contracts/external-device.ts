import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export const externalDeviceBffPath = '/api/bff/devices/external'
export type ExternalDevice = OrchestratorApiSchemas['ExternalAndroidDeviceDto']
export type ExternalDeviceAvailability = OrchestratorApiSchemas['ExternalDeviceAvailabilityDto']
export type ExternalUsbCandidate = OrchestratorApiSchemas['ExternalDeviceCandidateDto']
export type ExternalTcpCheck = OrchestratorApiSchemas['ExternalDeviceTcpCheckDto']
export type ExternalTcpPolicy = OrchestratorApiSchemas['ExternalTcpPolicyDto']
export type ExternalVerificationInstructions = OrchestratorApiSchemas['ExternalDeviceVerificationInstructionsDto']
export type ExternalViewerTarget = OrchestratorApiSchemas['ExternalViewerTargetDto']
export type ExternalViewerSession = OrchestratorApiSchemas['ExternalViewerSessionDto']
export type ExternalDeviceScreenshot = OrchestratorApiSchemas['ExternalViewerScreenshotDto']
export type ExternalDeviceLogcat = OrchestratorApiSchemas['ExternalViewerLogcatDto']
