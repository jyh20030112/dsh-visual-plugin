import type { VisionDescribeResult } from './vision.ts';
/** Build an intent-first prompt that treats OCR as supporting detail. */
export declare function visionPromptFor(userText: string): string;
/** Whether a nominally successful answer carries no useful visual content. */
export declare function isLowInformationDescription(description: string): boolean;
/** Run one vision request and retry once when it returns an OCR-only non-answer. */
export declare function describeWithLowInformationRetry(run: (prompt: string) => Promise<VisionDescribeResult>, userText: string): Promise<VisionDescribeResult>;
