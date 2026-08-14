/** One recent bridge activity row for the web panel's history feed. */
export interface RecentEntry {
    time: number;
    attachmentId: string;
    description: string;
}
/**
 * Record the newest description for an attachment.
 *
 * The automatic adapter bridge and the explicit follow-up tool can both
 * describe the same image. The panel models its history as one card per
 * attachment, so replace any previous rows before inserting the newest one.
 */
export declare function upsertRecent(recent: RecentEntry[], entry: RecentEntry, maxEntries: number): void;
