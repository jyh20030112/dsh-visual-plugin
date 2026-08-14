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
  给纯文本模型装上眼睛：把图片转发给 OpenAI 兼容的视觉模型，
  并在 Web UI 面板展示结果。
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh.md"><b>简体中文</b></a>
</p>

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。

## 特性

- 自动描述用户图片，供纯文本模型使用（`agent/pre-step` 拦截）
- `vision_describe` 工具支持对图片追问
- 右侧面板：配置接口 / 模型 / Key、测试连接、带缩略图的历史记录
- 以双端 dsh bundle 形式发布在 [npm](https://www.npmjs.com/package/dsh-visual-plugin)

## 安装

```sh
dsh plugin --profile web add dsh-visual-plugin
```

重启 `dsh web`，从侧栏底部打开面板，配置视觉接口 / 模型 / Key，在模型选择器中选 **DeepSeek (Vision)**，然后发送图片。

## 构建

```sh
npm run bootstrap && npm run typecheck && npm run build   # 需要本地 harness 检出
```

## CI/CD

`ci.yml` 在每次 push/PR 时校验；`release.yml`（tag `v*`）打包、创建 GitHub Release 并发布到 npm。

## 相关资源

- [PRD](docs/vision-bridge-prd.md)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## 许可证

[MIT](LICENSE)
