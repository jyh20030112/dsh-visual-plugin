import type {
  ModelImageDescription, ModelImageFailure, ModelImageOperation,
} from './model-messages.ts'

/** UI lifecycle of one logical automatic image description. */
export type VisionActivityStatus = 'running' | 'completed' | 'failed'

/** Host-owned, model-hidden activity returned to the browser UI. */
export interface VisionActivity {
  operationId: string
  attachmentId: string
  sessionId: string
  messageId?: string
  turn?: number
  status: VisionActivityStatus
  startedAt: number
  completedAt?: number
  description?: string
  error?: string
}

/** In-memory projection for automatic bridge UI activity. */
export class VisionActivityStore {
  private readonly entries = new Map<string, VisionActivity>()
  private readonly limit: number
  private readonly now: () => number

  constructor(limit = 100, now: () => number = Date.now) {
    this.limit = limit
    this.now = now
  }

  /** Begin one operation. Calls without a conversation identity have no inline UI target. */
  start(operation: ModelImageOperation, turn?: number): void {
    if (operation.sessionId === undefined) return
    this.entries.set(operation.operationId, {
      operationId: operation.operationId,
      attachmentId: operation.attachmentId,
      sessionId: operation.sessionId,
      ...(operation.messageId === undefined ? {} : { messageId: operation.messageId }),
      ...(turn === undefined ? {} : { turn }),
      status: 'running',
      startedAt: this.now(),
    })
    this.trim()
  }

  /** Settle one existing operation successfully without creating a duplicate row. */
  complete(operation: ModelImageDescription): void {
    this.finish(operation.operationId, {
      status: 'completed',
      description: operation.description,
    })
  }

  /** Settle one existing operation as failed without creating a duplicate row. */
  fail(operation: ModelImageFailure): void {
    this.finish(operation.operationId, { status: 'failed', error: operation.error })
  }

  /** Newest-first immutable snapshots for one conversation. */
  forSession(sessionId: string): VisionActivity[] {
    return [...this.entries.values()]
      .filter(entry => entry.sessionId === sessionId)
      .sort((left, right) => right.startedAt - left.startedAt)
      .map(entry => ({ ...entry }))
  }

  private finish(
    operationId: string,
    terminal: Pick<VisionActivity, 'status'> & Pick<VisionActivity, 'description' | 'error'>,
  ): void {
    const existing = this.entries.get(operationId)
    if (existing === undefined || existing.status !== 'running') return
    this.entries.set(operationId, {
      ...existing,
      ...terminal,
      completedAt: this.now(),
    })
  }

  private trim(): void {
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (oldest === undefined) return
      this.entries.delete(oldest)
    }
  }
}
