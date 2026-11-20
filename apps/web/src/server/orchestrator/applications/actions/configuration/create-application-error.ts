import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { unconfirmedAppCreationMessage } from '@/shared/contracts/application'
import { OrchestratorRequestError } from '../../../request'

const validationMessages = {
  name: 'Enter a name with at least 2 characters.',
  containerImage: 'Choose a runtime image.',
  containerArgs: 'Shorten the runtime arguments to 2,048 characters or fewer, including the runtime defaults.',
  uploadedApkId: 'Choose another saved APK, upload a new file, or clear the selection.',
  networkPolicyEnabled: 'Select a network access mode.',
  networkPolicyAllowCidrs: 'Use valid IPv4 ranges such as 10.20.0.0/16.',
  inactivityTimeoutSeconds: 'Enter a whole number of seconds from 0 to 86,400, or -1 for no automatic stop.',
  memoryLimitMb: 'Enter a whole number from 128 to 262,144 MB.',
  cpuLimitCpus: 'Enter a CPU limit from 0.1 to 128 cores.'
}

const applicationNameConflict = () => {
  const message = 'This owner already has an app with that name. Enter a different name.'
  return new PublicActionError(message, { code: 'conflict', status: 409, fieldErrors: { name: [message] } })
}

const validationFieldErrors = (fields: readonly string[] | undefined) => {
  const invalid = new Set(fields)
  return Object.fromEntries(
    Object.entries(validationMessages)
      .filter(([field]) => invalid.has(field))
      .map(([field, message]) => [field, [message]])
  )
}

const configurationFields = ['name', 'inactivityTimeoutSeconds', 'memoryLimitMb', 'cpuLimitCpus']

export const toUpdateApplicationError = (error: unknown): unknown => {
  if (!(error instanceof OrchestratorRequestError)) return error
  const { status, details } = error
  if (status === 409 && details?.code === 'application_name_taken') return applicationNameConflict()
  if (status === 400) {
    const fieldErrors = validationFieldErrors(details?.fields?.filter(field => configurationFields.includes(field)))
    if (Object.keys(fieldErrors).length) {
      return new PublicActionError('Review the highlighted fields and try again.', {
        code: 'validation',
        status,
        fieldErrors
      })
    }
  }
  return error
}

export const toCreateApplicationError = (error: unknown): unknown => {
  if (!(error instanceof OrchestratorRequestError)) return error

  const { status, details } = error
  if (status === 409 && details?.code === 'application_name_taken') return applicationNameConflict()
  if (status === 503 && details?.code === 'container_engine_unavailable') {
    return new PublicActionError(
      'The container engine is unavailable. Ask a platform administrator to check the Docker or Podman connection, then try again.',
      { code: 'upstream_unavailable', status }
    )
  }
  if (status === 502 || status === 503 || status === 504) {
    return new PublicActionError(unconfirmedAppCreationMessage, { code: 'upstream_unavailable', status })
  }
  if (status === 409 && (details?.code === 'feature_disabled' || details?.code === 'feature_unsupported')) {
    return new PublicActionError(
      'Restricted network access requires Firewall. Choose unrestricted access if you have permission, or ask a platform administrator to check Firewall.',
      { code: 'conflict', status }
    )
  }
  if (status === 409 && details?.code === 'apk_unavailable') {
    return new PublicActionError('The selected APK is unavailable for this app.', {
      code: 'conflict',
      status,
      fieldErrors: { uploadedApkId: [validationMessages.uploadedApkId] }
    })
  }
  if (status === 400) {
    const fieldErrors = validationFieldErrors(details?.fields)
    return new PublicActionError(
      Object.keys(fieldErrors).length
        ? 'Review the highlighted fields and try again.'
        : 'The app settings could not be validated. Review your settings and try again.',
      { code: 'validation', status, fieldErrors }
    )
  }
  return error
}
