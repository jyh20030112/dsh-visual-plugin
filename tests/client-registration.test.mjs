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

test('panel shows one latest card per image with expandable history', async () => {
  const source = await readFile(new URL('../src/client/VisionBridgePanel.tsx', import.meta.url), 'utf8')

  assert.match(source, /type PanelView = 'config' \| 'recent'/)
  assert.match(source, /history\.map\(\(entry\)/)
  assert.match(source, /const latest = entry\.descriptions\[0\]/)
  assert.match(source, /const older = entry\.descriptions\.slice\(1\)/)
  assert.match(source, /aria-expanded=\{expanded\}/)
  assert.match(source, /history\.emptyTitle/)
  assert.match(source, /DescriptionCopyButton text=\{latest\.description\}/)
})

test('every completed inline description exposes the shared copy action', async () => {
  const source = await readFile(new URL('../src/client/VisionDescribeCard.tsx', import.meta.url), 'utf8')
  const copySource = await readFile(new URL('../src/client/DescriptionCopyButton.tsx', import.meta.url), 'utf8')

  assert.match(source, /status === 'completed' && <DescriptionCopyButton/)
  assert.match(copySource, /navigator\.clipboard/)
  assert.match(copySource, /document\.execCommand\('copy'\)/)
})

test('panel styles use harness theme tokens and a large image preview', async () => {
  const css = await readFile(new URL('../src/client/VisionBridgePanel.module.css', import.meta.url), 'utf8')

  assert.match(css, /--dsw-alias-bg-base/)
  assert.match(css, /--dsw-alias-label-primary/)
  assert.match(css, /\.thumb\s*\{[\s\S]*height: 240px/)
  assert.match(css, /#root\):has\(\.panel\)/)
  assert.match(css, /width: calc\(100% - var\(--vision-bridge-panel-width\)\)/)
  assert.match(css, /overflow-y: auto/)
})
