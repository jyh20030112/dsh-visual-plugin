/** Browser-safe video projection returned by the plugin-owned HTTP service. */
export interface VideoItem {
    videoId: string;
    sessionId: string;
    fileName: string;
    mediaType: string;
    sizeBytes: number;
    status: string;
    createdAt: number;
    updatedAt: number;
    durationSeconds?: number;
    width?: number;
    height?: number;
    normalizedUrl?: string;
    posterUrl?: string;
    frameCount?: number;
    warnings: string[];
    error?: {
        code: string;
        message: string;
    };
    analysis?: {
        prompt: string;
        evidence: Array<{
            timestampsSeconds: number[];
            description: string;
        }>;
    };
}
/** Observable upload/list state for one conversation. */
export interface VideoClientState {
    videos: readonly VideoItem[];
    phase: 'idle' | 'uploading' | 'processing';
    progress: number;
    activeFileName?: string;
    error?: string;
    selection?: {
        token: number;
        videoId: string;
    };
}
/** Shared client module used by the input slots and the right-side panel. */
export declare class VideoClientController {
    private readonly states;
    private readonly listeners;
    snapshot(sessionId: string): VideoClientState;
    subscribe(sessionId: string, listener: () => void): () => void;
    refresh(sessionId: string): Promise<void>;
    upload(sessionId: string, file: File): Promise<void>;
    delete(sessionId: string, videoId: string): Promise<void>;
    select(sessionId: string, videoId: string): void;
    private update;
}
