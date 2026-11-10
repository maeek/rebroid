type Surface = { id: string; sessionId: string }

export class DisplaySessionRecovery {
  private waiting: { applicationId: string; surface: Surface } | undefined

  request(applicationId: string, surface: Surface, surfaces: Surface[]): boolean {
    const waiting = this.waiting
    if (waiting?.applicationId === applicationId && surfaces.some(current => current.id === waiting.surface.id)) {
      return false
    }
    this.waiting = { applicationId, surface }
    return true
  }

  presented(applicationId: string, surface: Surface): void {
    const waiting = this.waiting
    if (waiting?.applicationId !== applicationId) return
    if (surface.id === waiting.surface.id && surface.sessionId !== waiting.surface.sessionId) {
      this.waiting = undefined
    }
  }
}
