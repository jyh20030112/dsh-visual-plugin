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

test('configuration registers a card in the settings plugins surface', async () => {
  const source = await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  assert.match(source, /ctx\.slots\.inject\('settings\.plugin\.item'/)
  assert.match(source, /VisionBridgeCardController/)
  // The vision-bridge namespace is not on the settings gateway allowlist, so the
  // card reads the config through the host route instead of the settings scope.
  assert.doesNotMatch(source, /settingsScope\.bind|dsh-client-ui-settings\/client/)
})

test('settings card reads and writes through the host config route', async () => {
  const source = await readFile(new URL('../src/client/vision-bridge-card-controller.ts', import.meta.url), 'utf8')
  assert.match(source, /fetch\('\/vision-bridge\/config'/)
  assert.doesNotMatch(source, /settingsScope\.bind|dsh-client-ui-settings\/client/)
})

test('settings card reports local video dependency health', async () => {
  const source = await readFile(new URL('../src/client/VisionBridgeCard.tsx', import.meta.url), 'utf8')
  assert.match(source, /fetch\('\/vision-bridge\/videos\/health'\)/)
  assert.match(source, /videoHealth\.available/)
  assert.match(source, /ffmpeg.*sceneDetect/s)
})

test('panel shows one latest card per image with expandable history, config-free', async () => {
  const source = await readFile(new URL('../src/client/VisionBridgePanel.tsx', import.meta.url), 'utf8')

  assert.match(source, /history\.map\(\(entry\)/)
  assert.match(source, /const latest = entry\.descriptions\[0\]/)
  assert.match(source, /const older = entry\.descriptions\.slice\(1\)/)
  assert.match(source, /aria-expanded=\{expanded\}/)
  assert.match(source, /history\.emptyTitle/)
  assert.match(source, /DescriptionCopyButton text=\{latest\.description\}/)
  assert.doesNotMatch(source, /vision-bridge\/config|vision-bridge\/balance/)
})

test('panel is mouse-resizable via a clamped left-edge drag', async () => {
  const source = await readFile(new URL('../src/client/VisionBridgePanel.tsx', import.meta.url), 'utf8')
  assert.match(source, /clampPanelWidth/)
  assert.match(source, /onPointerDown/)
  assert.match(source, /setPointerCapture/)
})

test('video upload is plugin-owned and mounted beside the conversation input', async () => {
  const registration = await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  const uploader = await readFile(new URL('../src/client/VideoUploadButton.tsx', import.meta.url), 'utf8')

  assert.match(registration, /ctx\.slots\.inject\('conversation\.input\.left'/)
  assert.match(registration, /ctx\.slots\.inject\('conversation\.input\.dock'/)
  assert.match(uploader, /VIDEO_ACCEPT = .*\.mp4.*\.m4v.*\.mov.*\.avi.*\.mpg.*\.mpeg.*\.mkv.*\.webm/)
  assert.match(uploader, /accept=\{VIDEO_ACCEPT\}/)
  assert.match(uploader, /type="file"/)
})

test('right panel switches between image history and directly playable videos', async () => {
  const source = await readFile(new URL('../src/client/VisionBridgePanel.tsx', import.meta.url), 'utf8')

  assert.match(source, /'images' \| 'videos'/)
  assert.match(source, /<video[\s\S]*controls[\s\S]*src=\{video\.normalizedUrl\}/)
  assert.match(source, /video\.posterUrl/)
  assert.match(source, /video\.fileName/)
})

test('selecting a video stages a question in the draft without auto-submitting', async () => {
  const uploader = await readFile(new URL('../src/client/VideoUploadButton.tsx', import.meta.url), 'utf8')
  const panel = await readFile(new URL('../src/client/VisionBridgePanel.tsx', import.meta.url), 'utf8')

  assert.match(panel, /videoController\.select/)
  assert.match(uploader, /inputActions\.setDraft/)
  assert.doesNotMatch(uploader, /inputActions\.submit/)
})

test('every completed inline description exposes the shared copy action', async () => {
  const source = await readFile(new URL('../src/client/VisionDescribeCard.tsx', import.meta.url), 'utf8')
  const copySource = await readFile(new URL('../src/client/DescriptionCopyButton.tsx', import.meta.url), 'utf8')

  assert.match(source, /status === 'completed' && <DescriptionCopyButton/)
  assert.match(copySource, /navigator\.clipboard/)
  assert.match(copySource, /document\.execCommand\('copy'\)/)
})

test('panel styles use harness theme tokens, a large image preview, and a resize handle', async () => {
  const css = await readFile(new URL('../src/client/VisionBridgePanel.module.css', import.meta.url), 'utf8')

  assert.match(css, /--dsw-alias-bg-base/)
  assert.match(css, /--dsw-alias-label-primary/)
  assert.match(css, /\.thumb\s*\{[\s\S]*height: 240px/)
  assert.match(css, /\.resizeHandle\s*\{[\s\S]*cursor: ew-resize/)
  assert.match(css, /overflow-y: auto/)
})
