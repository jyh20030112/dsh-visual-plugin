import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ContentBlock, ImageBlock, Message } from '@deepseek-ai/dsh-llm'

/** Facts needed to describe one model-bound image. */
export interface ModelImageRequest {
  attachment: ImageAttachmentRef
  userText: string
  signal?: AbortSignal
}

/** Request-scoped facts supplied by the wrapper adapter. */
export interface ModelImageRewriteContext {
  signal?: AbortSignal
  sessionId?: string
}

/** Stable identity shared by every event in one logical description operation. */
export interface ModelImageOperation {
  operationId: string
  attachmentId: string
  sessionId?: string
  messageId?: string
}

/** One successful automatic description, for recent-history presentation. */
export interface ModelImageDescription extends ModelImageOperation {
  description: string
}

/** One failed automatic description, already normalized for presentation. */
export interface ModelImageFailure extends ModelImageOperation {
  error: string
}

/** Dependencies kept outside the model-message transformation policy. */
export interface ModelImageBridgeOptions {
  describe(request: ModelImageRequest): Promise<string>
  onStart?(entry: ModelImageOperation): void
  onDescription(entry: ModelImageDescription): void
  onFailure?(entry: ModelImageFailure): void
  failureText(error: unknown): string
}

class DescriptionFailure extends Error {
  readonly displayText: string

  constructor(displayText: string, options: ErrorOptions) {
    super(displayText, options)
    this.displayText = displayText
  }
}

/** Extract the user's question/intent from one message. */
function userTextOf(message: Message): string {
  return message.content
    .filter(block => block.type === 'text')
    .map(block => (block as { text?: string }).text ?? '')
    .join('\n')
    .trim()
}

/**
 * Rewrites images only at the outbound model boundary.
 *
 * Durable session messages remain untouched, while repeated model steps reuse
 * the first successful automatic description for each attachment.
 */
export class ModelImageBridge {
  private readonly pending = new Map<string, Promise<string>>()
  private readonly resolved = new Map<string, string>()
  private readonly options: ModelImageBridgeOptions
  private nextOperation = 0

  constructor(options: ModelImageBridgeOptions) {
    this.options = options
  }

  /** Return a completed automatic description without starting new work. */
  cachedDescription(attachmentId: string): string | undefined {
    return this.resolved.get(attachmentId)
  }

  /** Seed the cache with a previously persisted description (startup restore). */
  seedResolved(attachmentId: string, description: string): void {
    this.resolved.set(attachmentId, description)
  }

  /** Build model-bound copies of messages containing image blocks. */
  async rewrite(
    messages: readonly Message[],
    context: ModelImageRewriteContext = {},
  ): Promise<readonly Message[]> {
    let changed = false
    const rewritten = await Promise.all(messages.map(async (message): Promise<Message> => {
      const messageId = typeof (message as { id?: unknown }).id === 'string'
        ? String(message.id)
        : undefined
      const result = await this.rewriteContent(message.content, userTextOf(message), context, messageId)
      if (!result.changed) return message
      changed = true
      return { ...message, content: result.content }
    }))
    return changed ? rewritten : messages
  }

  /** Rewrite images at every core content depth, including read_image tool results. */
  private async rewriteContent(
    content: readonly ContentBlock[],
    userText: string,
    context: ModelImageRewriteContext,
    messageId?: string,
  ): Promise<{ content: ContentBlock[]; changed: boolean }> {
    const results = await Promise.all(content.map(async (block): Promise<{
      block: ContentBlock
      changed: boolean
    }> => {
      if (block.type === 'tool-result') {
        const nested = await this.rewriteContent(block.content, userText, context, messageId)
        return nested.changed
          ? { block: { ...block, content: nested.content }, changed: true }
          : { block, changed: false }
      }
      if (block.type !== 'image') return { block, changed: false }

      const attachment = (block as ImageBlock).attachment
      const attachmentId = String(attachment.attachmentId)
      try {
        const description = await this.descriptionFor(attachment, userText, context, messageId)
        return {
          block: {
            type: 'text',
            text: `[视觉描述] ${description}\n[附件] ${attachmentId}\n`,
          },
          changed: true,
        }
      } catch (error) {
        const failure = error instanceof DescriptionFailure
          ? error.displayText
          : this.options.failureText(error)
        return {
          block: {
            type: 'text',
            text: `[视觉描述失败] ${failure}\n[附件] ${attachmentId}\n`,
          },
          changed: true,
        }
      }
    }))
    return {
      content: results.map(result => result.block),
      changed: results.some(result => result.changed),
    }
  }

  private async descriptionFor(
    attachment: ImageAttachmentRef,
    userText: string,
    context: ModelImageRewriteContext,
    messageId?: string,
  ): Promise<string> {
    const attachmentId = String(attachment.attachmentId)
    const key = attachmentId
    const resolved = this.resolved.get(key)
    if (resolved !== undefined) return resolved
    const existing = this.pending.get(key)
    if (existing !== undefined) return existing
    const operation: ModelImageOperation = {
      operationId: `${Date.now().toString(36)}-${(++this.nextOperation).toString(36)}`,
      attachmentId,
      ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
      ...(messageId === undefined ? {} : { messageId }),
    }
    this.options.onStart?.(operation)
    const pending = this.options.describe({ attachment, userText, signal: context.signal })
      .then((description) => {
        this.resolved.set(key, description)
        this.options.onDescription({ ...operation, description })
        return description
      }, (error: unknown) => {
        const displayText = this.options.failureText(error)
        this.options.onFailure?.({ ...operation, error: displayText })
        throw new DescriptionFailure(displayText, { cause: error })
      })
    this.pending.set(key, pending)
    try {
      return await pending
    } finally {
      if (this.pending.get(key) === pending) this.pending.delete(key)
    }
  }

}
