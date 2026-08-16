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

## How it works

<p align="center">
  <img src="https://raw.githubusercontent.com/jyh20030112/dsh-visual-plugin/main/assets/vision-bridge-flow.svg" width="720" alt="Animated demo of the vision bridge in dsh web: the user sends an image, the vision bridge auto-describes it, and the main model answers from the description">
</p>

```
image in composer or tool result → wrapper finds it at any content depth → visible message keeps the image
  → adapter stream → readImage → vision API → "[视觉描述] …" in the private model request only
  → text-only model answers → /vision-bridge/recent → panel thumbnail + description (2s poll)
```

Unconfigured or failed calls degrade to a `[视觉描述失败] <reason>` placeholder, so the conversation never breaks.

## Quick start

```sh
dsh plugin --profile web add dsh-visual-plugin   # or: github:jyh20030112/dsh-visual-plugin
```

When developing this checkout against a local DeepSeek Harness source tree, install the local package instead:

```sh
cd /absolute/path/to/dsh-visual-plugin
npm run bootstrap
dsh plugin --profile web add link:/absolute/path/to/dsh-visual-plugin
```

`bootstrap` automatically finds a sibling or ancestor-adjacent Harness checkout.
For another layout, set its location explicitly:

```sh
HARNESS=/absolute/path/to/deepseek-harness npm run bootstrap
```

Restart `dsh web`, then:

1. Open **Settings → Plugins → Plugin configuration** and expand the **Vision Bridge** card:

   <img src="https://raw.githubusercontent.com/jyh20030112/dsh-visual-plugin/main/assets/vision-bridge-config.png" width="560" alt="Vision Bridge configuration card in the settings plugin configuration tab">

2. Fill in the endpoint URL, the vision model name, and the API key. The **侧边栏 / Sidebar** toggle shows or hides the image-history panel; the history limit defaults to 20, and leaving it empty means unlimited. Click **保存 / Save**, then **测试连接 / Test connection**.
3. In the model picker, select provider **DeepSeek (Vision)** — the plugin's wrapper adapter declares image input so the gateway admits uploads.
4. Send an image (optionally with a question). The model answers from the generated description, and the image-history panel shows the thumbnail + description within ~2s.

### Reference local model

This project is developed and tested with a locally deployed
[Empero AI Qwythos-9B](https://huggingface.co/empero-ai/Qwythos-9B-Claude-Mythos-5-1M)
as the vision backend. Its SGLang deployment can expose an OpenAI-compatible
`/v1` endpoint; enter the endpoint URL and the server's registered model name
(for example, `Qwythos`) in the Vision Bridge panel. The plugin is not tied to
Qwythos-9B and can use any compatible vision model.

## Uninstall

```sh
dsh plugin --profile web remove dsh-visual-plugin
```

Restart `dsh web`. The command forwards to `pnpm remove` inside the profile, and the bundle layer list reconciles to drop the plugin automatically.

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

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the plugin host this project extends.
- [Qwythos-9B on Hugging Face](https://huggingface.co/empero-ai/Qwythos-9B-Claude-Mythos-5-1M) — the local vision model used for development and testing.
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) — the curated DSH plugin list where this plugin is registered.

## Thanks

- [HsiangNianian](https://github.com/HsiangNianian/) — for their help and insights during development.
- [dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) — a DSH Web UI plugin that auto-resumes interrupted requests with 「继续」 (error classification, adaptive backoff, browser notifications); a handy companion.

## License

[MIT](LICENSE)
