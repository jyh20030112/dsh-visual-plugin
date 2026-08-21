import type { FrameInterpreter } from './types.ts';
interface VisionFacts {
    url: string;
    apiKey: string;
    model: string;
}
/** Bind frame interpretation to the plugin's existing vision configuration. */
export declare function createVisionFrameInterpreter(resolveFacts: () => Promise<VisionFacts | undefined>): FrameInterpreter;
export {};
