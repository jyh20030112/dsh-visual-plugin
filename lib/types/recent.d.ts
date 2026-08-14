/** One completed description for an image. */
export interface RecentDescription {
    time: number;
    description: string;
}
/** One image group in the recent panel, newest-updated image first. */
export interface RecentEntry {
    attachmentId: string;
    sessionId?: string;
    updatedAt: number;
    descriptions: RecentDescription[];
}
/** Input produced by one completed automatic or explicit vision call. */
export interface RecentDescriptionInput {
    time: number;
    attachmentId: string;
    sessionId?: string;
    description: string;
}
/**
 * Retain a completed description under its image group.
 *
 * Re-describing an image moves that image to the front, exposes the new answer
 * as its latest description, and retains the older intent-specific answers in
 * that same group. Both image groups and per-image descriptions are bounded.
 */
export declare function recordRecent(recent: RecentEntry[], entry: RecentDescriptionInput, maxImages: number, maxDescriptionsPerImage: number): void;
