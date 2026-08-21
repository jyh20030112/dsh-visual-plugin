import type { CommandRunner } from './process-runner.ts';
/** Run both required detectors and derive the bounded initial frame timestamps. */
export declare function sceneTimestamps(options: {
    executable: string;
    input: string;
    outputDir: string;
    durationSeconds: number;
    limit: number;
    run: CommandRunner;
    signal?: AbortSignal;
}): Promise<number[]>;
