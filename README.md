# dsh-visual-plugin

<p align="center">
  <img src="https://raw.githubusercontent.com/jyh20030112/dsh-visual-plugin/main/assets/deepseek_neon_pixel_whale_transparent.svg" width="240" alt="DeepSeek neon pixel whale">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-visual-plugin"><img src="https://img.shields.io/npm/v/dsh-visual-plugin?logo=npm&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-visual-plugin"><img src="https://img.shields.io/npm/dm/dsh-visual-plugin?label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/jyh20030112/dsh-visual-plugin/stargazers"><img src="https://img.shields.io/github/stars/jyh20030112/dsh-visual-plugin?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/jyh20030112/dsh-visual-plugin/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <br>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=fff" alt="TypeScript">
  <img src="https://img.shields.io/badge/zero__runtime__deps-16a34a?style=flat" alt="zero runtime deps">
</p>

<p align="center">
  Give your text-only model eyes: forward user images to any OpenAI-compatible
  vision model and see the results in a Web UI right panel.
</p>

<p align="center">
  <a href="README.md"><b>English</b></a> · <a href="README.zh.md">简体中文</a>
</p>

A plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Features

- **Automatic description** — the wrapper adapter recursively describes uploaded images and image-bearing tool results in a model-bound copy while the visible chat keeps the originals.
- **In-conversation lifecycle cards** — automatic analysis appears immediately below its source image and settles in place as success or failure; one logical analysis produces one card.
- **Intent-aware prompts** — send an image *with a question* and the description is generated from your own words.
- **`vision_describe` tool** — the model can answer a later follow-up question when the automatic description lacks the requested detail.
- **Right-side panel** — configure endpoint / model / key, test the connection, watch one latest description per image with thumbnails (2s auto-refresh), read remaining balance.
- **Secrets stay secret** — the API key lives in the harness credentials seam (write-only, never echoed).

## Quick start

```sh
dsh plugin --profile web add dsh-visual-plugin   # or: github:jyh20030112/dsh-visual-plugin
```

Restart `dsh web`, then:

1. Open the panel from the sidebar footer (**视觉桥接 / Vision Bridge**).
2. Configure the endpoint URL, a vision model name, and the API key; click **保存配置** → **测试连接**.
3. In the model picker, select provider **DeepSeek (Vision)** — the plugin's wrapper adapter declares image input so the gateway admits uploads.
4. Send an image (optionally with a question). The model answers from the generated description and the panel shows the thumbnail + description within ~2s.

## How it works

```
image in composer or tool result → wrapper finds it at any content depth → visible message keeps the image
  → adapter stream → readImage → vision API → "[视觉描述] …" in the private model request only
  → text-only model answers → /vision-bridge/recent → panel thumbnail + description (2s poll)
```

Unconfigured or failed calls degrade to a `[视觉描述失败] <reason>` placeholder, so the conversation never breaks.

## Project layout

```
src/
  index.ts      host plugin: vision orchestration + vision_describe + HTTP routes
  vision.ts     OpenAI-compatible vision calls (describe / test / balance)
  model-messages.ts  model-bound image rewrite + per-attachment cache
  description-policy.ts  intent-first prompt + low-information retry
  config.ts     settings namespace `vision-bridge` + schema
  adapter.ts    deepseek-vision wrapper adapter (admission + private rewrite boundary)
  client/       browser half: panel / sidebar toggle / automatic + tool cards / locales / css
cordis.patch.yml  bundle patch layer
```

## Build

```sh
npm run bootstrap && npm run typecheck && npm run build   # needs a local harness checkout
```

Prebuilt `lib/` is committed, so consumers never build.

## CI/CD

`ci.yml` verifies artifacts and the pack contents on every push/PR. `release.yml` (tag `v*`) checks the version, packs, creates a GitHub Release, and publishes to npm.

## Resources

- [PRD](docs/vision-bridge-prd.md) · [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## License

[MIT](LICENSE)
