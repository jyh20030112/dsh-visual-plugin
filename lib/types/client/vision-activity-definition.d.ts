import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client';
/** Renderer payload for automatic descriptions owned by one visible message. */
export interface VisionActivityChatData {
    readonly messageId: string;
    readonly attachmentIds: readonly string[];
}
declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
    interface ChatNodeDataMap {
        /** Model-hidden automatic image descriptions anchored after their source message. */
        'vision-activity': VisionActivityChatData;
    }
}
/** Anchor a model-hidden activity projection immediately after its image message. */
export declare const visionActivityDefinition: ConversationNodeDefinition<VisionActivityChatData>;
