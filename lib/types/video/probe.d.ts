import type { CommandRunner } from './process-runner.ts';
export type ContainerFamily = 'iso-bmff' | 'avi' | 'mpeg-ps' | 'matroska' | 'webm';
export interface VideoStreamProbe {
    index: number;
    codecName: string;
    pixelFormat: string;
    width: number;
    height: number;
    frameRate: number;
    hdr: boolean;
    interlaced: boolean;
    alpha: boolean;
}
export interface VideoProbe {
    family: ContainerFamily;
    durationSeconds: number;
    stream: VideoStreamProbe;
    hasAudio: boolean;
}
/** Inspect an untrusted local upload and cross-check its declared container family. */
export declare function inspectVideo(options: {
    path: string;
    originalFileName: string;
    ffprobe: string;
    run: CommandRunner;
    signal?: AbortSignal;
    maxDurationSeconds?: number;
    maxDimension?: number;
}): Promise<VideoProbe>;
