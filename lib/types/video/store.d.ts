import type { PreparedVideo, VideoSnapshot } from './types.ts';
declare const MANIFEST_VERSION = 1;
export interface VideoManifest {
    version: typeof MANIFEST_VERSION;
    snapshot: VideoSnapshot;
    declaredSize?: number;
    prepared?: PreparedVideo;
}
/** Restrict one user-owned storage directory on POSIX; chmod is harmlessly best-effort on Windows. */
export declare function ensurePrivateDirectory(path: string): Promise<void>;
/** Resolve a job directory from an opaque id without permitting nested paths. */
export declare function jobDirectory(rootDir: string, videoId: string): string;
/** Atomically commit one complete manifest. */
export declare function writeManifest(jobDir: string, manifest: VideoManifest): Promise<void>;
/** Restore valid manifests and isolate corrupt or unsupported files by omission. */
export declare function loadManifests(rootDir: string): Promise<VideoManifest[]>;
/** Sum regular-file bytes below one opaque job directory without following links. */
export declare function directorySize(path: string): Promise<number>;
export {};
