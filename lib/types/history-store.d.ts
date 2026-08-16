/**
 * Persistent JSONL store for image description history.
 *
 * One file per image (named by the image's content hash), one JSON record per
 * line. The host half appends a line whenever an image is described, and reads
 * the whole directory back at startup so restarts reuse prior descriptions
 * instead of re-describing old images. Pure Node `fs`, no harness storage seam.
 * @module dsh-visual-plugin/history-store
 */
/** One persisted description record. */
export interface HistoryRecord {
    /** Full attachment id (content hash), e.g. `sha256:be3ebaf…`. */
    attachmentId: string;
    /** Session that produced this description; undefined when there was none. */
    sessionId?: string;
    /** When the description completed (epoch ms). */
    time: number;
    /** The description text. */
    description: string;
}
/** Derive the JSONL filename for an attachment id (strip the `algo:` prefix). */
export declare function fileNameFor(attachmentId: string): string;
/**
 * Append one description record to the image's JSONL file.
 * @param dir - the store directory (e.g. `~/.dsh/.visual_plugin`).
 * @param entry - the record to persist.
 */
export declare function record(dir: string, entry: HistoryRecord): Promise<void>;
/**
 * Load every persisted record across all images, newest-write order unspecified.
 * Corrupt lines and unreadable files are skipped, and a missing directory
 * yields an empty list (the store is best-effort).
 * @param dir - the store directory.
 * @returns the flat list of records.
 */
export declare function load(dir: string): Promise<HistoryRecord[]>;
