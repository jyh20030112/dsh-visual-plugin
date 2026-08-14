# dsh-visual-plugin

Vision bridge plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):
when the main model has **no vision**, forward user images to a configurable
OpenAI-compatible vision model and show the results in a Web UI right panel.

- **Host half** — `agent/pre-step` image interception (auto-describes every
  attached image before it reaches the text-only model), the `vision.describe`
  tool for follow-up questions, `/vision-bridge/{test,balance,recent}` routes,
  and a `deepseek-vision` wrapper adapter that lets the web gateway admit image
  uploads.
- **Browser half** — a right-side floating panel (`shell.overlay`) to configure
  `url` / `model` / `api_key`, test the connection, and watch recent image
  descriptions with thumbnails; a sidebar toggle; and a `vision.describe`
  tool card in the conversation.

Distributed as a **publishable dual-half dsh bundle**:
`"dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web" } }`.

## Install

```sh
# from an npm tarball / local checkout
dsh plugin --profile web add ./dsh-visual-plugin-0.1.0.tgz

# or from a git host (prebuilt lib/ is committed, so no prepare build is needed;
# pnpm >= 10 still requires an allowBuilds entry only when a prepare script runs)
dsh plugin --profile web add github:jyh20030112/dsh-visual-plugin
```

Then **restart** `dsh web` (client-package metadata is cached per boot), open the
Web UI, and click **视觉桥接 / Vision Bridge** in the sidebar footer.

## Configure

In the panel:

1. **接口地址 / Endpoint URL** — an OpenAI-compatible `/chat/completions` base,
   e.g. `https://api.deepseek.com` (or a GLM-4V/SiliconFlow/Moonshot endpoint).
2. **模型名称 / Model name** — a vision-capable model, e.g. `glm-4v-flash`.
3. **API Key** — entered once, stored through the credentials seam (never in
   settings, never echoed back).
4. Click **保存配置** then **测试连接**; a successful test shows latency.

For the **conversation model**, select provider **DeepSeek (Vision)** in the Web
model picker. That provider route is the wrapper adapter: it advertises image
input (so uploads are admitted) and delegates every request to the underlying
`deepseek-official` adapter after rewriting image blocks to text placeholders.

## How it works

```
user pastes/drops an image in the composer
  -> sessions.prompt (gateway admits it: deepseek-vision declares image input)
  -> user/message carries an ImageBlock (durable attachment id)
  -> agent/pre-step: vision-bridge intercepts
       - reads the attachment bytes (ctx.attachments.readImage)
       - calls the configured vision API (describeImage)
       - rewrites the block to "[视觉描述] <description>\n[附件] <id>"
       - failure fallback: "[视觉描述失败] <reason>" (the model keeps going)
  -> the text-only model answers from the description
  -> the panel polls /vision-bridge/recent and shows thumbnail + description
follow-up: the model calls vision.describe(<attachmentId>) -> new recent entry
```

API keys never leave the credentials seam; vision calls use
`Authorization: Bearer`, `redirect: 'manual'`, a 60s timeout, and a normalized
error vocabulary (`AUTH / QUOTA / RATE_LIMIT / TIMEOUT / NETWORK / PROTOCOL /
HTTP / CONFIG`).

## Build from source

The plugin targets the **current** harness API. The npm-published
`@deepseek-ai/*` packages are still `0.0.1-rc.1` (older API), so building
requires a local harness checkout whose packages are installed and built:

```sh
# layout: <dev>/deepseek_workspace/dsh-visual-plugin + <dev>/deepseek-harness
./scripts/bootstrap.sh     # symlink node_modules to the harness dependency tree
node node_modules/typescript/bin/tsc -p tsconfig.json    # lib/types (declarations)
node node_modules/tsdown/dist/run.mjs                    # lib/index.js + lib/client.js
```

Prebuilt artifacts (`lib/`) are committed, so consumers do not need to build.

## Project layout

```
src/
  index.ts          host plugin: pre-step interception + vision.describe + routes
  vision.ts         OpenAI-compatible vision calls (describe/test/balance)
  config.ts         settings namespace `vision-bridge` + schema
  adapter.ts        FR0 wrapper adapter: deepseek-vision route (image intake)
  invariant.ts      invariant companion
  client/
    index.tsx       slot registrations (panel / toggle / tool card)
    store.ts        shared open/closed store
    VisionBridgePanel.tsx / VisionBridgeToggle.tsx / VisionDescribeCard.tsx
    locales.ts      zh/en dictionaries
    *.module.css    styles
cordis.patch.yml    bundle patch layer (inserts the vision-bridge row)
```

Design and requirements: `docs/vision-bridge-prd.md` in the harness workspace
(PRD v1.1); the host/client reference implementations this plugin is rebuilt
from live as gitignored compiled artifacts in the harness checkout
(`packages/extensions/vision-bridge/lib` and `packages/client/ui-vision-bridge/lib`).
