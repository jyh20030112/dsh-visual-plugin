import type {
  ChatConversationViewNode, ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'

/** Renderer payload for automatic descriptions owned by one visible message. */
export interface VisionActivityChatData {
  readonly messageId: string
  readonly attachmentIds: readonly string[]
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** Model-hidden automatic image descriptions anchored after their source message. */
    'vision-activity': VisionActivityChatData
  }
}

function attachmentIdsOf(content: readonly ContentBlock[]): string[] {
  const ids: string[] = []
  for (const block of content) {
    if (block.type === 'image') {
      ids.push(String(block.attachment.attachmentId))
      continue
    }
    if (block.type === 'tool-result') ids.push(...attachmentIdsOf(block.content))
  }
  return [...new Set(ids)]
}

function imageMessage(event: Parameters<ConversationNodeDefinition['match']>[0]): {
  readonly messageId: string
  readonly attachmentIds: readonly string[]
} | undefined {
  const message = event.type === 'user/message'
    ? event.data
    : event.type === 'tool/result' ? event.data.message : undefined
  if (message === undefined) return undefined
  const attachmentIds = attachmentIdsOf(message.content)
  return attachmentIds.length === 0
    ? undefined
    : { messageId: String(message.id), attachmentIds }
}

/** Anchor a model-hidden activity projection immediately after its image message. */
export const visionActivityDefinition: ConversationNodeDefinition<VisionActivityChatData> = {
  kind: 'vision-activity',
  target: 'chat',
  match: (event) => {
    const message = imageMessage(event)
    return message === undefined ? null : { id: message.messageId, role: 'start' }
  },
  start: (_context, match) => {
    const message = imageMessage(match.event)
    if (message === undefined) throw new Error('vision-activity start requires an image-bearing message')
    return message
  },
  update: context => context.state,
  buildViewNode: (context): ChatConversationViewNode | null => {
    if (context.start === undefined || context.state === undefined) return null
    return {
      key: context.key,
      kind: 'vision-activity',
      id: context.id,
      target: 'chat',
      // The source message/tool row owns the integer seq. This small offset
      // keeps the bridge directly after it and before the next durable event.
      anchorSeq: context.start.event.seq + 0.1,
      location: context.start.location,
      visibility: 'visible',
      data: context.state,
    }
  },
}
