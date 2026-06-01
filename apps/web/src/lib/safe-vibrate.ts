export const safeVibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate(pattern)
  } catch {
    // Ignore vibration errors (e.g., when the API is not supported)
  }
}
