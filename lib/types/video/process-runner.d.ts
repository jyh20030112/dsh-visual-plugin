export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
export interface CommandRunOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    cwd?: string;
    outputLimitBytes?: number;
}
export type CommandRunner = (executable: string, args: readonly string[], options?: CommandRunOptions) => Promise<CommandResult>;
/** Run one local media command without a shell and with bounded diagnostics. */
export declare const runCommand: CommandRunner;
