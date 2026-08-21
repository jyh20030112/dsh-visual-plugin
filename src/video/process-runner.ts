import { spawn } from 'node:child_process'

const DEFAULT_OUTPUT_LIMIT = 64 * 1024

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface CommandRunOptions {
  signal?: AbortSignal
  timeoutMs?: number
  cwd?: string
  outputLimitBytes?: number
}

export type CommandRunner = (
  executable: string,
  args: readonly string[],
  options?: CommandRunOptions,
) => Promise<CommandResult>

function appendBounded(
  current: Buffer<ArrayBufferLike>,
  chunk: Buffer<ArrayBufferLike>,
  limit: number,
): Buffer<ArrayBufferLike> {
  if (current.byteLength >= limit) return current
  return Buffer.concat([current, chunk.subarray(0, limit - current.byteLength)])
}

/** Run one local media command without a shell and with bounded diagnostics. */
export const runCommand: CommandRunner = (executable, args, options = {}) =>
  new Promise((resolve, reject) => {
    options.signal?.throwIfAborted()
    const child = spawn(executable, [...args], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    })
    const limit = options.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0)
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0)
    let settled = false
    let forceTimer: ReturnType<typeof setTimeout> | undefined

    const killTree = (signal: NodeJS.Signals): void => {
      if (process.platform !== 'win32' && child.pid !== undefined) {
        try {
          process.kill(-child.pid, signal)
          return
        } catch {
          // The group may already be gone; fall through to the direct child.
        }
      }
      child.kill(signal)
    }
    const terminate = (): void => {
      if (child.exitCode !== null || child.signalCode !== null) return
      killTree('SIGTERM')
      forceTimer = setTimeout(() => killTree('SIGKILL'), 1_000)
      forceTimer.unref()
    }
    const onAbort = (): void => terminate()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    const timeout = options.timeoutMs === undefined
      ? undefined
      : setTimeout(terminate, options.timeoutMs)
    timeout?.unref()

    child.stdout.on('data', (chunk: Buffer) => { stdout = appendBounded(stdout, chunk, limit) })
    child.stderr.on('data', (chunk: Buffer) => { stderr = appendBounded(stderr, chunk, limit) })
    child.once('error', (error: NodeJS.ErrnoException) => {
      if (settled) return
      settled = true
      if (timeout !== undefined) clearTimeout(timeout)
      if (forceTimer !== undefined) clearTimeout(forceTimer)
      options.signal?.removeEventListener('abort', onAbort)
      if (error.code === 'ENOENT') {
        resolve({ stdout: '', stderr: error.message, exitCode: 127 })
      } else {
        reject(error)
      }
    })
    child.once('close', (code) => {
      if (settled) return
      settled = true
      if (timeout !== undefined) clearTimeout(timeout)
      if (forceTimer !== undefined) clearTimeout(forceTimer)
      options.signal?.removeEventListener('abort', onAbort)
      if (options.signal?.aborted === true) {
        reject(options.signal.reason ?? new DOMException('The operation was aborted', 'AbortError'))
        return
      }
      resolve({ stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), exitCode: code ?? 1 })
    })
  })
