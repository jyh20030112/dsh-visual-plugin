import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('automatic vision activity is never mounted in the composer dock', async () => {
  const source = await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(
    source,
    /conversation\.input\.dock[\s\S]{0,260}ActiveVisionDescriptions/,
  )
})
