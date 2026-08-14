import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ContentBlock, ImageBlock, Message } from '@deepseek-ai/dsh-llm'

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
      const result = await this.rewriteContent(message.content, userTextOf(message), signal)
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
    signal?: AbortSignal,
  ): Promise<{ content: ContentBlock[]; changed: boolean }> {
    const results = await Promise.all(content.map(async (block): Promise<{
      block: ContentBlock
      changed: boolean
    }> => {
      if (block.type === 'tool-result') {
        const nested = await this.rewriteContent(block.content, userText, signal)
        return nested.changed
          ? { block: { ...block, content: nested.content }, changed: true }
          : { block, changed: false }
      }
      if (block.type !== 'image') return { block, changed: false }

      const attachment = (block as ImageBlock).attachment
      const attachmentId = String(attachment.attachmentId)
      try {
        const description = await this.descriptionFor(attachment, userText, signal)
        return {
          block: {
            type: 'text',
            text: `[视觉描述] ${description}\n[附件] ${attachmentId}\n`,
          },
          changed: true,
        }
      } catch (error) {
        return {
          block: {
            type: 'text',
            text: `[视觉描述失败] ${this.options.failureText(error)}\n[附件] ${attachmentId}\n`,
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
