# dsh-visual-plugin

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
  给纯文本模型装上眼睛：把用户图片转发给任意 OpenAI 兼容的视觉模型，
  并在 Web UI 右侧面板实时展示结果。
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh.md"><b>简体中文</b></a>
</p>

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。

## 特性

- **自动描述图片** —— 输入栏发图后，`agent/pre-step` 拦截图片块，在到达纯文本模型前改写为 `[视觉描述] <描述>` 文本。
- **按问题定向描述** —— 发图同时带问题时，描述提示词由你的原话生成。
- **`vision_describe` 工具** —— 模型可对任意已附图追问细节。
- **右侧面板** —— 配置接口 / 模型 / Key、测试连接、查看最近描述（缩略图 + 2 秒自动刷新）、剩余额度。
- **密钥不落地** —— API Key 经 harness credentials 缝存储（只写不回显）。

## 快速开始

```sh
dsh plugin --profile web add dsh-visual-plugin   # 或：github:jyh20030112/dsh-visual-plugin
```

**重启** `dsh web` 后：

1. 从侧栏底部打开面板（**视觉桥接 / Vision Bridge**）。
2. 配置接口地址、视觉模型名、API Key；点 **保存配置** → **测试连接**。
3. 在模型选择器中选 **DeepSeek (Vision)** —— 插件的包装适配器声明支持图片输入，网关才会放行上传。
4. 发送一张图片（可附带问题）。主模型基于生成的描述作答，面板约 2 秒内出现缩略图 + 描述。

## 工作原理

```
发图 → 网关放行（DeepSeek (Vision)）→ agent/pre-step 拦截
  → readImage → 视觉 API（按问题意图的提示词）→ 图片块改写为 "[视觉描述] …" 文本
  → 纯文本模型作答 → /vision-bridge/recent → 面板缩略图 + 描述（2s 轮询）
```

未配置或调用失败时降级为 `[视觉描述失败] <原因>` 占位文本，对话不会中断。

## 项目结构

```
src/
  index.ts      host 插件：pre-step 拦截 + vision_describe + HTTP 路由
  vision.ts     OpenAI 兼容视觉调用（describe / test / balance）
  config.ts     settings 命名空间 `vision-bridge` + schema
  adapter.ts    deepseek-vision 包装适配器（图片入站使能）
  client/       浏览器半：面板 / 侧栏开关 / 工具卡片 / 文案 / 样式
cordis.patch.yml  bundle 补丁层
```

## 构建

```sh
npm run bootstrap && npm run typecheck && npm run build   # 需要本地 harness 检出
```

预构建 `lib/` 已提交，使用者无需构建。

## CI/CD

`ci.yml` 在每次 push/PR 校验产物与打包内容；`release.yml`（tag `v*`）校验版本、打包、创建 GitHub Release 并发布到 npm。

## 相关资源

- [PRD](docs/vision-bridge-prd.md) · [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## 许可证

[MIT](LICENSE)
