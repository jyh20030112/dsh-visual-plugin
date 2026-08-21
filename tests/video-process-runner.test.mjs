import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runCommand } from '../src/video/process-runner.ts'

test('aborting a media command terminates its descendant process tree', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX process-group assertion')
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-process-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  const marker = join(rootDir, 'descendant-survived')
  const grandchild = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'alive'), 350)`
  const parent = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }); setInterval(() => {}, 1000)`
  const controller = new AbortController()
  const running = runCommand(process.execPath, ['-e', parent], { signal: controller.signal, timeoutMs: 5_000 })
  setTimeout(() => controller.abort(), 60)

  await assert.rejects(running, error => error.name === 'AbortError')
  await new Promise(resolve => setTimeout(resolve, 500))
  await assert.rejects(access(marker), error => error.code === 'ENOENT')
})
