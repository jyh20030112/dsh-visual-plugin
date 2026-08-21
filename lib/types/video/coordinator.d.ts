import type { VideoCoordinator, VideoCoordinatorOptions } from './types.ts';
/** Install the deep coordinator module over storage and media adapters. */
export declare function createVideoCoordinator(options: VideoCoordinatorOptions): Promise<VideoCoordinator>;
