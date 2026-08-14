import type { ModelImageDescription, ModelImageFailure, ModelImageOperation } from './model-messages.ts';
/** UI lifecycle of one logical automatic image description. */
export type VisionActivityStatus = 'running' | 'completed' | 'failed';
/** Host-owned, model-hidden activity returned to the browser UI. */
export interface VisionActivity {
    operationId: string;
    attachmentId: string;
    sessionId: string;
    messageId?: string;
    turn?: number;
    status: VisionActivityStatus;
    startedAt: number;
    completedAt?: number;
    description?: string;
    error?: string;
}
/** In-memory projection for automatic bridge UI activity. */
export declare class VisionActivityStore {
    private readonly entries;
    private readonly limit;
    private readonly now;
    constructor(limit?: number, now?: () => number);
    /** Begin one operation. Calls without a conversation identity have no inline UI target. */
    start(operation: ModelImageOperation, turn?: number): void;
    /** Settle one existing operation successfully without creating a duplicate row. */
    complete(operation: ModelImageDescription): void;
    /** Settle one existing operation as failed without creating a duplicate row. */
    fail(operation: ModelImageFailure): void;
    /** Newest-first immutable snapshots for one conversation. */
    forSession(sessionId: string): VisionActivity[];
    private finish;
    private trim;
}
