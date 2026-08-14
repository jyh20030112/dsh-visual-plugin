<p align="center">
  <a href="https://www.npmjs.com/package/dsh-visual-plugin"><img src="https://img.shields.io/npm/v/dsh-visual-plugin?logo=npm&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-visual-plugin"><img src="https://img.shields.io/npm/dm/dsh-visual-plugin?label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/jyh20030112/dsh-visual-plugin/stargazers"><img src="https://img.shields.io/github/stars/jyh20030112/dsh-visual-plugin?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/jyh20030112/dsh-visual-plugin/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <br>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=fff" alt="TypeScript">
  <img src="https://img.shields.io/badge/zero__runtime__deps-16a34a?style=flat" alt="zero runtime deps">
</p>

# dsh-visual-plugin

<p align="center">
  Give your text-only model eyes: forward images to an OpenAI-compatible
  vision model and see results in a Web UI panel.
</p>

<p align="center">
  <a href="README.md"><b>English</b></a> · <a href="README.zh.md">简体中文</a>
</p>

A plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Features

- Automatically describes user images for text-only models (`agent/pre-step` interception)
- `vision_describe` tool for follow-up questions
- Right-side panel: configure endpoint / model / key, test connection, history with thumbnails
- Published as a dual-half dsh bundle on [npm](https://www.npmjs.com/package/dsh-visual-plugin)

## Install

```sh
dsh plugin --profile web add dsh-visual-plugin
```

Restart `dsh web`, open the panel from the sidebar footer, configure the vision endpoint / model / key, pick provider **DeepSeek (Vision)** in the model picker, then send an image.

## Build

```sh
npm run bootstrap && npm run typecheck && npm run build   # needs a local harness checkout
```

## CI/CD

`ci.yml` verifies on every push/PR; `release.yml` (tag `v*`) packs, creates a GitHub Release, and publishes to npm.

## Resources

- [PRD](docs/vision-bridge-prd.md)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## License

[MIT](LICENSE)
