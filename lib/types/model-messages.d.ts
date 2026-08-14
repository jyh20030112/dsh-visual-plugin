import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { Message } from '@deepseek-ai/dsh-llm';
/** Facts needed to describe one model-bound image. */
export interface ModelImageRequest {
    attachment: ImageAttachmentRef;
    userText: string;
    signal?: AbortSignal;
}
/** Request-scoped facts supplied by the wrapper adapter. */
export interface ModelImageRewriteContext {
    signal?: AbortSignal;
    sessionId?: string;
}
/** Stable identity shared by every event in one logical description operation. */
export interface ModelImageOperation {
    operationId: string;
    attachmentId: string;
    sessionId?: string;
    messageId?: string;
}
/** One successful automatic description, for recent-history presentation. */
export interface ModelImageDescription extends ModelImageOperation {
    description: string;
}
/** One failed automatic description, already normalized for presentation. */
export interface ModelImageFailure extends ModelImageOperation {
    error: string;
}
/** Dependencies kept outside the model-message transformation policy. */
export interface ModelImageBridgeOptions {
    describe(request: ModelImageRequest): Promise<string>;
    onStart?(entry: ModelImageOperation): void;
    onDescription(entry: ModelImageDescription): void;
    onFailure?(entry: ModelImageFailure): void;
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
    private nextOperation;
    constructor(options: ModelImageBridgeOptions);
    /** Return a completed automatic description without starting new work. */
    cachedDescription(attachmentId: string, sessionId?: string): string | undefined;
    /** Build model-bound copies of messages containing image blocks. */
    rewrite(messages: readonly Message[], context?: ModelImageRewriteContext): Promise<readonly Message[]>;
    /** Rewrite images at every core content depth, including read_image tool results. */
    private rewriteContent;
    private descriptionFor;
    private cacheKey;
}
