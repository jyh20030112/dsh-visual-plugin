# dsh-visual-plugin

<p align="center">
  <img src="https://raw.githubusercontent.com/jyh20030112/dsh-visual-plugin/main/assets/deepseek_neon_pixel_whale_transparent.svg" width="240" alt="DeepSeek 霓虹像素鲸鱼">
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
  给纯文本模型装上眼睛：把用户图片转发给任意 OpenAI 兼容的视觉模型，
  并在 Web UI 右侧面板实时展示结果。
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh.md"><b>简体中文</b></a>
</p>

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。

## 特性

- **自动描述图片** —— 包装适配器递归处理上传图片及工具结果中的图片，只在发给模型的副本中生成 `[视觉描述]`，聊天界面保留原内容。
- **对话内状态卡片** —— 自动解析开始后立即在原图片下方显示“正在解析”，成功或失败后原位更新；同一逻辑解析只显示一张卡片。
- **按问题定向描述** —— 发图同时带问题时，描述提示词由你的原话生成。
- **`vision_describe` 工具** —— 模型可对任意已附图追问细节。
- **右侧面板** —— 配置接口 / 模型 / Key、测试连接、查看最近描述（缩略图 + 2 秒自动刷新）、剩余额度。
- **密钥不落地** —— API Key 经 harness credentials 缝存储（只写不回显）。

## 工作原理

<p align="center">
  <img src="https://raw.githubusercontent.com/jyh20030112/dsh-visual-plugin/main/assets/vision-bridge-flow.svg" width="720" alt="dsh web 中视觉桥接的动画演示：用户发图，视觉桥自动描述，主模型基于描述作答">
</p>

```
输入栏或工具结果产生图片 → 包装适配器递归发现 → 聊天记录保留原始图片
  → adapter stream → readImage → 视觉 API → 仅在模型私有请求中改写为 "[视觉描述] …"
  → 纯文本模型作答 → /vision-bridge/recent → 面板缩略图 + 描述（2s 轮询）
```

未配置或调用失败时降级为 `[视觉描述失败] <原因>` 占位文本，对话不会中断。

## 快速开始

```sh
dsh plugin --profile web add dsh-visual-plugin   # 或：github:jyh20030112/dsh-visual-plugin
```

若使用本地 DeepSeek Harness 源码开发，请改为链接本地插件目录：

```sh
cd /absolute/path/to/dsh-visual-plugin
npm run bootstrap
dsh plugin --profile web add link:/absolute/path/to/dsh-visual-plugin
```

`bootstrap` 会自动查找同级或祖先目录旁的 Harness 检出。其他布局请显式指定：

```sh
HARNESS=/absolute/path/to/deepseek-harness npm run bootstrap
```

**重启** `dsh web` 后：

1. 打开 **设置 → 插件 → 插件配置**，展开 **视觉桥接** 卡片：

   <img src="https://raw.githubusercontent.com/jyh20030112/dsh-visual-plugin/main/assets/vision-bridge-config.png" width="560" alt="设置插件配置标签页里的视觉桥接配置卡片">

2. 填写接口地址、视觉模型名、API Key。**侧边栏** 开关控制图片历史面板的显示/隐藏；历史描述上限默认 20，留空表示不限制。点 **保存**，再 **测试连接**。
3. 在模型选择器中选 **DeepSeek (Vision)** —— 插件的包装适配器声明支持图片输入，网关才会放行上传。
4. 发送一张图片（可附带问题）。主模型基于生成的描述作答，图片历史面板约 2 秒内出现缩略图 + 描述。

### 参考本地模型

本项目目前使用本地部署的
[Empero AI Qwythos-9B](https://huggingface.co/empero-ai/Qwythos-9B-Claude-Mythos-5-1M)
作为视觉后端进行开发和验证。该模型可通过 SGLang 提供 OpenAI 兼容的
`/v1` 接口；在视觉桥接面板中填写接口地址和服务端注册的模型名称
（例如 `Qwythos`）即可。插件并不绑定 Qwythos-9B，也可以接入其他兼容的视觉模型。

## 卸载

```sh
dsh plugin --profile web remove dsh-visual-plugin
```

重启 `dsh web`。该命令会在 profile 内转发执行 `pnpm remove`，bundle 层列表会自动同步移除该插件。

## 项目结构

```
src/
  index.ts      host 插件：视觉编排 + vision_describe + HTTP 路由
  vision.ts     OpenAI 兼容视觉调用（describe / test / balance）
  model-messages.ts  模型请求边界改写 + 按附件缓存
  description-policy.ts  意图优先提示词 + 低信息重试
  config.ts     settings 命名空间 `vision-bridge` + schema
  adapter.ts    deepseek-vision 包装适配器（图片入站 + 私有改写边界）
  client/       浏览器半：面板 / 侧栏开关 / 自动解析与工具卡片 / 文案 / 样式
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

- [Hugging Face 上的 Qwythos-9B](https://huggingface.co/empero-ai/Qwythos-9B-Claude-Mythos-5-1M) · [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## 致谢

- [HsiangNianian](https://github.com/HsiangNianian/) — 感谢开发过程中的帮助与建议。
- [dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) — 网络错误等异常导致请求被中断时自动发送「继续」恢复的 DSH 插件（错误分类、自适应退避、浏览器通知），很好用的搭配。

## 许可证

[MIT](LICENSE)
