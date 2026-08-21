import type { MediaEngine } from './types.ts';
import { type CommandRunner } from './process-runner.ts';
export interface SystemMediaEngineOptions {
    run?: CommandRunner;
    ffmpegPath?: string;
    ffprobePath?: string;
    sceneDetectPath?: string;
}
/** Create the production FFmpeg/PySceneDetect adapter with injectable command execution for tests. */
export declare function createSystemMediaEngine(options?: SystemMediaEngineOptions): MediaEngine;
