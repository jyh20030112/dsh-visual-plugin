import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { Message } from '@deepseek-ai/dsh-llm';
/** Facts needed to describe one model-bound image. */
export interface ModelImageRequest {
    attachment: ImageAttachmentRef;
    userText: string;
    signal?: AbortSignal;
}
/** One successful automatic description, for recent-history presentation. */
export interface ModelImageDescription {
    attachmentId: string;
    description: string;
}
/** Dependencies kept outside the model-message transformation policy. */
export interface ModelImageBridgeOptions {
    describe(request: ModelImageRequest): Promise<string>;
    onDescription(entry: ModelImageDescription): void;
    failureText(error: unknown): string;
}
/**
 * Rewrites images only at the outbound model boundary.
 *
 * Durable session messages remain untouched, while repeated model steps reuse
 * the first successful automatic description for each attachment.
 */
export declare class ModelImageBridge {
    private readonly pending;
    private readonly resolved;
    private readonly options;
    constructor(options: ModelImageBridgeOptions);
    /** Return a completed automatic description without starting new work. */
    cachedDescription(attachmentId: string): string | undefined;
    /** Build model-bound copies of messages containing image blocks. */
    rewrite(messages: readonly Message[], signal?: AbortSignal): Promise<readonly Message[]>;
    private descriptionFor;
}
