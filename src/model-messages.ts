import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ImageBlock, Message } from '@deepseek-ai/dsh-llm'

/** Facts needed to describe one model-bound image. */
export interface ModelImageRequest {
  attachment: ImageAttachmentRef
  userText: string
  signal?: AbortSignal
}

/** One successful automatic description, for recent-history presentation. */
export interface ModelImageDescription {
  attachmentId: string
  description: string
}

/** Dependencies kept outside the model-message transformation policy. */
export interface ModelImageBridgeOptions {
  describe(request: ModelImageRequest): Promise<string>
  onDescription(entry: ModelImageDescription): void
  failureText(error: unknown): string
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

  constructor(options: ModelImageBridgeOptions) {
    this.options = options
  }

  /** Return a completed automatic description without starting new work. */
  cachedDescription(attachmentId: string): string | undefined {
    return this.resolved.get(attachmentId)
  }

  /** Build model-bound copies of messages containing image blocks. */
  async rewrite(messages: readonly Message[], signal?: AbortSignal): Promise<readonly Message[]> {
    let changed = false
    const rewritten = await Promise.all(messages.map(async (message): Promise<Message> => {
      if (!message.content.some(block => block.type === 'image')) return message
      changed = true
      const userText = userTextOf(message)
      const content = await Promise.all(message.content.map(async (block) => {
        if (block.type !== 'image') return block
        const attachment = (block as ImageBlock).attachment
        const attachmentId = String(attachment.attachmentId)
        try {
          const description = await this.descriptionFor(attachment, userText, signal)
          return {
            type: 'text' as const,
            text: `[视觉描述] ${description}\n[附件] ${attachmentId}\n`,
          }
        } catch (error) {
          return {
            type: 'text' as const,
            text: `[视觉描述失败] ${this.options.failureText(error)}\n[附件] ${attachmentId}\n`,
          }
        }
      }))
      return { ...message, content }
    }))
    return changed ? rewritten : messages
  }

  private async descriptionFor(
    attachment: ImageAttachmentRef,
    userText: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const attachmentId = String(attachment.attachmentId)
    const existing = this.pending.get(attachmentId)
    if (existing !== undefined) return existing
    const pending = this.options.describe({ attachment, userText, signal })
      .then((description) => {
        this.resolved.set(attachmentId, description)
        this.options.onDescription({ attachmentId, description })
        return description
      })
    this.pending.set(attachmentId, pending)
    try {
      return await pending
    } catch (error) {
      if (this.pending.get(attachmentId) === pending) this.pending.delete(attachmentId)
      throw error
    }
  }
}
