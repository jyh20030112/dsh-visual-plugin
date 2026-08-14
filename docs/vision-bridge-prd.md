# PRD：Vision Bridge —— DeepSeek Harness 视觉桥接插件

| 项目 | 内容 |
|---|---|
| 产品 | `@deepseek-ai/dsh-vision-bridge`（可发布 bundle，Host 工具 + Client 面板双端） |
| 版本 | v1.1（合入 Host 侧探讨结论：图片上传网关门槛与包装适配器方案） |
| 状态 | 设计定稿，待实现 |
| 对象 | 部署了**无视觉能力** DeepSeek 模型的 DeepSeek Harness（Web GUI）用户 |

---

## 1. 背景与问题陈述

### 1.1 问题

- 用户部署的 DeepSeek 模型**没有图像识别能力**（无视觉模块），但使用场景中用户需要在对话中发图片，并期望模型能"看懂"图片、回答关于图片的追问。
- Harness 本体原生支持图片附件：Web 输入栏已有粘贴/拖放/上传（`ui-attachment` 的 `AttachmentRail/DropOverlay/ImageLightbox`，`ui-conversation/src/client/skeleton/InputBar.tsx`），草稿携带 `imageIds`，发送时 base64 为 `{type:'image', mediaType, data}` content part；宿主把已接受的图片提交为附件（`packages/attachment`）。**缺的是"无视觉模型如何消费这些图片"这一环。**

### 1.2 关键调研发现（一手证据）

#### ① 仓库内存在**完整**的参考实现（两半都是编译产物，源码/清单文件已删）

| 半 | 位置（编译产物，gitignored） | 内容 |
|---|---|---|
| Host | `packages/extensions/vision-bridge/lib/types/{index,vision,config,invariant}.js`（533 行） | adapter 模型私有请求改写、`vision_describe` 工具、`/vision-bridge/{test,balance,recent}` 路由、settings/credentials 配置 |
| Client | `packages/client/ui-vision-bridge/lib/types/client/{index,store,VisionBridgePanel,VisionBridgeToggle,VisionDescribeCard,locales}.js`（289 行） | `shell.overlay` 右侧浮动面板（配置表单+测试+余额+历史缩略图）、`sidebar.footer.action` 开关、`tool.call.toolview` keyed `vision_describe` 结果卡片、zh/en 文案 |

**与需求逐条对应**：url/model_name/api_key 配置表单 ✓；测试连接 ✓；发图自动调用（adapter 只改写模型私有请求）✓；聊天界面保留原始图片 ✓；图片+结果右侧面板同步显示（recent 历史 + 缩略图）✓；追问工具 `vision_describe` ✓。

**参考实现缺失的部分**（即本项目要补的）：CSS Modules、两个包的 package.json/tsconfig/cordis.patch.yml、tsconfig.client.json 引用行、web-app browser plugin roster 接线、可发布 bundle 打包。且参考实现里 `ctx.layout.toggleVisionBridge()` 依赖对 layout 服务的进程内扩展——**第三方 bundle 应改用 store seat 的 actions（open/toggle/close），不碰 layout 服务**。

#### ② 右侧面板的可行位置（client Slots 实测 + 参考实现印证）

- `details`（single/session）：右侧详情列，**被 ui-conversation DetailsPanel 占用**，注册即替换（挤掉工具详情）。
- **`shell.overlay`（list/root，叠加式）**：参考实现即注册于此（id `vision-bridge-panel`，order 100）；`ui-cordis` 的 CordisPanel 同款。**定稿选它**。
- 开关：`sidebar.footer.action`（list 槽，加性）——参考实现同款（`vision-bridge-toggle`）。

#### ③ 第三方双端 bundle 运行时**可行**（有测试佐证）

- `packages/client/modules` Node 半按 `ctx.loader.entries()`（已挂载且未 disabled 的插件行）+ `createRequire(ctx.baseUrl)`（baseUrl=profile 目录）解析包 → 包声明 `dsh.client.platform==='web'` 且 `exports["./client"]` 存在即入 boot graph → `/plugins/<id>/client.js` 懒加载；**没有任何"必须在仓库内"的检查**（`modules/tests/node-half.client.spec.ts` 用 `@fixture/*` 第三方形态包证明）。
- 硬约束：patch 必须**显式 insert 一行**（无自动发现）；**预构建产物必须随包发布**（缺 `lib/client.js` 抛 `MissingClientBundleError`）；浏览器半需复刻 closure-factory + externals 纪律（react 必须 external，防双 React 实例）；**安装后需重启**（包元数据负判定缓存不失效）。
- 构建协议（`packages/client/tsdown.client.ts` 的 `clientBundle()`）**未发布到 npm**，需自带一份副本。

#### ④ **关键硬约束：图片上传网关门槛（原参考实现的缺口）**

- 浏览器发图经 `sessions.prompt` RPC → apiproxy 检查当前模型 `resolveModelInfo().inputModalities`，**不含 `image` 即拒绝上传**：`MODEL_DOES_NOT_SUPPORT_IMAGES`（`packages/host/apiproxy/src/api-proxy.ts:2482-2494`）。
- llm-deepseek 声明 `inputModalities:['text']`（`llm-deepseek/src/adapter.ts:113`），且其序列化器对含图消息直接抛 `UNSUPPORTED_CONTENT`（`llm-deepseek/src/serialize.ts:63-68`）。
- **推论**：图片必须先以原始 `ImageBlock` 进入会话日志并供 UI 展示，再在模型请求边界完成私有改写。因此本插件注册一个**包装适配器**：
  1. `resolveModel()` 返回 `inputModalities` 追加 `'image'` → 放行网关上传；
  2. `stream()` 内读取附件、调用视觉模型，并只在委托给文本模型的消息副本中改写为 `[视觉描述]`（避免 `UNSUPPORTED_CONTENT` 且不污染可见 `user/message`）。
- 权衡：包装适配器会改变该 provider 的模型目录语义（模型在 UI 上显示支持 image 输入）——接受并文档化（ADR-8）。

#### ⑤ 通信通道（Client 探讨子代理结论）

- **配置读写**：`api.settings.describe/update`（命名空间 `vision-bridge`）+ `api.credentials.describe/set`（apiKey 只写不读，`credentials.set` 后清空输入框）——参考实现即此模式。
- **测试连接/余额/历史**：同源 `fetch('/vision-bridge/test' | '/balance' | '/recent')`（webServer 路由）——无需 RPC/事件白名单。
- **缩略图**：`api.sessions.attachment({sessionId, attachmentId})` → base64 data URL。
- 自定义事件推送（如 `vision/result`）需改 `api/remotes/src/remote-events.ts` 白名单（仓库内改动）——**第三方 bundle 不做**，用轮询 `/recent`。

---

## 2. 目标与非目标

### 2.1 目标（G）

- **G1（自动转述）**：用户发图片后，可见会话保留原图，无视觉主模型通过 adapter 私有请求副本收到文字描述并正常作答。
- **G2（可追问）**：模型通过 `vision_describe` 工具对指定图片回答后续问题；对话中渲染专用结果卡片。
- **G3（配置面板）**：Web UI 右侧浮动面板配置视觉服务（url / model_name / api_key）、测试连接、显示结果与余额。
- **G4（同步展示）**：用户发的图片与视觉结果在面板历史中同步显示（缩略图 + 描述 + 时间）；同一附件只显示一张卡片，后续描述更新原卡片并置顶。
- **G5（可发布）**：以 npm bundle 打包（`dsh.bundle.patch` + `dsh.client`），`dsh plugin --profile <name> add <pkg>` 可安装，满足 `docs/user/develop/basic/publish.md` 规范。

### 2.2 非目标（NG）

- 不修改官方 LLM 适配器源码、不改 Harness 本体（不依赖 `remote-events` 白名单、不扩展 layout 服务等仓库内改动）；**但**以插件方式注册"包装适配器"（`ctx.llm.registerAdapter` 新增 provider 变体，放行图片输入）是插件自身的合法扩展，属于本项目范围。
- 不做图像生成、OCR 产品化、目标检测等通用视觉能力（仅"描述 + 追问"）。
- 不要求主模型升级为多模态；本插件的前提就是主模型无视觉。
- 余额查询保留接口与面板展示（参考实现已含，成本低）。

---

## 3. 用户与使用场景

### 3.1 核心场景

- **S1 配置**：点击侧栏底部"视觉桥接"开关 → 右侧浮动面板 → 填 `接口地址` / `模型名称` / `API Key`（密码框，仅填一次）→ `保存配置` → `测试连接`（显示延迟或错误码）。
- **S2 图片自动描述**：输入栏粘贴/上传/拖拽图片，或 `read_image` 等工具结果返回嵌套图片 → 聊天记录仍显示原始内容；adapter 递归改写私有请求中的图片，主模型收到 `[视觉描述] <text>\n[附件] <id>` 并正常回复；面板"最近描述"出现唯一卡片；当前轮工具调用复用自动描述缓存。
- **S3 追问**：后续轮次询问"图里的报错信息是什么？"且已有描述不足 → 模型调用 `vision_describe(attachmentId)` → 对话中渲染"视觉桥接"结果卡片；面板更新该附件的原记录并置顶。
- **S4 未配置/失败**：未配置时发图 → 可见消息仍保留原图，模型私有请求降级为 `[视觉描述失败] vision model is not configured (set it in the right-side panel)`，模型不崩溃；API 错误按错误码显示在面板。

---

## 4. 功能需求（FR）

### FR0 Host：包装适配器（图片入站使能器，必需）

- 经 `ctx.llm.registerAdapter(['deepseek-vision'], wrapper)` 注册包装适配器，委托底层 provider 适配器：
  - `resolveModel()`：返回 `{...underlying, inputModalities: [...underlying.inputModalities, 'image']}` → **放行网关图片上传**（否则 `MODEL_DOES_NOT_SUPPORT_IMAGES`）。
  - `stream()`：异步生成视觉描述，在不修改原消息对象的前提下，把模型请求副本中的 `ImageBlock` 改写为 `[视觉描述] <text>\n[附件] <id>` 后委托底层。
- 模型目录语义变化（该 provider 模型显示支持 image 输入）为已知权衡（ADR-8）。

### FR1 Host：图片自动描述（adapter 模型请求边界）

- adapter 收到的模型消息在任意 core content 深度含 `image` 块时触发（包括 `tool-result.content[]`），durable 消息与聊天 UI 不改写：
  1. `resolvedFacts()`：settings（url/model/apiKeyEnv）+ credentials 解析，缺失 → 仅在模型请求副本中替换为失败文案。
  2. `attachments.readImage(ref, signal)` → base64 → `describeImage(url, apiKey, model, data, mediaType, prompt?, signal)`。
  3. 模型请求副本的图片块改写为文本块 `[视觉描述] <text>\n[附件] <attachmentId>`；原始消息保留图片；记录 `attachmentId → ref` 映射（供 `vision_describe`）。
  4. 按 `attachmentId` 缓存首次成功的自动描述，跨 model step 复用；写入或替换 `recent` 记录（新记录置顶，上限 20）。
  5. 若视觉接口只返回“图片中没有文字”等低信息回答，以更强的意图优先提示词重试一次；不得无限重试。
- 失败降级（文案进 i18n）：
  - 附件服务不可用 → `[视觉描述失败] the attachment service is unavailable`
  - 未配置 → `[视觉描述失败] vision model is not configured (set it in the right-side panel)`
  - API 错误 → `[视觉描述失败] <code>: <message>`

### FR2 Host：`vision_describe` 工具

- 参数：`attachmentId`（string, required）、`prompt`（string, optional，默认 `Describe this image in detail, including any visible text.`）。
- 行为：仅在后续轮次且已有描述不足时，按 id 解析 ref → 读图 → 调视觉 API（60s 超时，`exec.signal` 联动取消）→ 返回 `{description}`；`output.render` 输出文本；按附件 id 更新 `recent` 原记录并置顶。
- 未知 id：`vision_describe: unknown attachment <id>`（错误可见）。

### FR3 Host：配置模型（settings + credentials 分工）

- settings 命名空间 `vision-bridge`：`{url: string, model: string, apiKeyEnv: string}`；`apiKeyEnv` 用 `role('credential-ref')`，默认 `VISION_API_KEY`。
- **api_key 绝不进 settings 明文**：存 credentials（环境变量引用），Web 网关"值不可见、只可写"（`docs/capability-seams.md` credentials 缝约束）。
- 面板侧读写：`api.settings.describe/update` + `api.credentials.describe/set`（参考实现同款）。

### FR4 Host：HTTP 路由（`ctx.webServer.register`，kind exact）

| 路由 | 方法 | 入参 | 出参 |
|---|---|---|---|
| `/vision-bridge/test` | POST | `{url, model, apiKey?}`（apiKey 空则回退已配置凭据） | `{ok, latencyMs, echo?}` 或 `{ok:false, error:{code,message}}` |
| `/vision-bridge/balance` | GET | - | `{supported, lines?}` 或 `{supported:false, error}` |
| `/vision-bridge/recent` | GET | - | `{entries:[{time, attachmentId, description}]}` |

- `callChatCompletions`：Bearer 认证、`redirect: 'manual'`（3xx 视为失败防泄密）、60s 超时（`DEFAULT_VISION_TIMEOUT_MS`）、`max_tokens: 1024`、错误体截断 500 字符、`/chat/completions` 后缀缺失自动补全。
- 错误归一化词汇：`AUTH / QUOTA / RATE_LIMIT / TIMEOUT / NETWORK / PROTOCOL / HTTP`（401/403→AUTH，402→QUOTA，429→RATE_LIMIT）。
- balance 已识别端点：DeepSeek `/user/balance`、SiliconFlow `/v1/user/info`、Moonshot `/v1/users/me/balance`（未知报 unsupported）。

### FR5 Client：右侧浮动面板（`shell.overlay`，list 槽，id `vision-bridge-panel`，order 100）

面板结构（参考实现 VisionBridgePanel.js）：
1. **配置区**：url / model_name / api_key（password）三字段 + `保存配置` / `测试连接` / `刷新` 三按钮；状态行（已保存/未配置/测试中/连接成功(latency)/失败(code+message)）；api_key 保存后清空、只显示"已配置/未配置"。
2. **额度区**：`/balance` 结果（supported→逐行 currency/available/total；unsupported/unavailable→提示）。
3. **历史区**：`/recent` 条目列表（缩略图 + 描述 + `附件 {id}`）；缩略图按需 `api.sessions.attachment` 加载；空态提示。
- 打开时加载配置与历史；开关按钮在 `sidebar.footer.action`（id `vision-bridge-toggle`，`aria-pressed` 反映 open 态）。
- **对话内结果卡片**：`tool.call.toolview` keyed `vision_describe` 渲染 `VisionDescribeCard`（settled 态显示描述，running 走通用卡片）。
- i18n：zh/en 字典（参考实现 locales.js 全量文案可直接采用，见附录）。
- **不依赖 layout 服务扩展**：开合走 store seat actions（参考实现同款 defineStore：`{open}` + toggle/close）。

### FR6 Client：配置读写

- `api.settings.describe({})` → 定位 `vision-bridge` 命名空间 → 回填 url/model；`api.credentials.describe({refs:[apiKeyEnv]})` → keyConfigured 状态。
- 保存：`api.settings.update({ns, patch:{url, model}})` + 若填了 key → `api.credentials.set({ref, value})` 后清空。
- 测试连接：`fetch('/vision-bridge/test', POST)`（表单当前值，未保存也可测——与 `ModelListEditor` 的 "Fetch available models" 同构）。

### FR7 Client：历史同步显示

- 轮询 `GET /vision-bridge/recent`（打开面板时加载；刷新按钮手动；间隔轮询为可选增强）。首版不做事件推送（第三方 bundle 无法改 remote-events 白名单）。
- 每个附件最多一条：缩略图（`api.sessions.attachment` → data URL）、最新描述文本、附件 id；新增或更新记录置顶。

### FR8 端到端触发链路

```
输入栏发图（ui-attachment：粘贴/拖放/上传 → createDraftImages → base64 content part）
  → sessions.prompt RPC：网关校验 inputModalities（包装适配器已声明 image → 放行；否则 MODEL_DOES_NOT_SUPPORT_IMAGES）
  → 宿主提交附件，user/message 携带 ImageBlock（attachmentId = 内容寻址 sha256:…）
  → user/message 原样持久化并显示图片 + 用户问题
  → deepseek-vision adapter stream() 创建模型私有消息副本
      ├─ 配置缺失 → 私有副本中使用 [视觉描述失败] 占位（模型继续，不崩）
      └─ 正常 → readImage → 视觉 API → 私有副本改写为 [视觉描述] + recent 记录
  → 主模型基于文本描述正常作答；原始会话消息仍为 ImageBlock
  → 面板轮询 /recent → 右侧浮动面板显示缩略图+描述
后续追问且已有描述不足 → 模型调用 vision_describe(attachmentId) → 对话结果卡片 + 面板原记录更新并置顶
```

### FR9 错误与状态

- 错误码词汇 Host/面板共用；面板显示 code+message（脱敏）；`redirect: manual` 防重定向泄密；错误体截断。
- 面板状态：未配置 / 测试中 / 已连接 / 失败；apiKey 状态：已配置/未配置（不回显）。

---

## 5. 非功能需求（NFR）

- **安全**：api_key 仅存 credentials（write-only）；不出现在 settings 明文、日志、模型上下文、前端读回；Bearer 请求不跟随重定向；错误信息脱敏。
- **性能**：单次描述 60s 超时；低信息回答最多重试一次；同附件自动描述跨 step 缓存；`recent` 上限 20；面板按需加载缩略图。
- **兼容**：OpenAI 兼容 `/chat/completions`；支持多图（逐图描述，每图一次调用）；gif/png/jpeg/webp（与输入栏 MIME 校验一致）。
- **可发布性**：满足 bundle 规范（`dsh.bundle.patch` → `cordis.patch.yml`）；client 半 `dsh.client.platform:'web'` + `exports["./client"]` + 预构建 `lib/client.js`；`files` 含 `lib/index.js`、`lib/client.js`、`cordis.patch.yml`、`lib/types/**/*.d.ts`；**自备 tsdown.client.ts 协议副本**；react 保持 external。
- **测试**：host 单测（模型私有副本递归改写且原消息不变、嵌套工具结果图片可通过 DeepSeek 文本序列化、缓存、低信息重试、同轮工具保护、settings/credentials 解析）、client 组件测试（表单/历史/卡片）、e2e（安装 → 发图 → 可见消息保留原图 → 面板显示 → 追问）。

---

## 6. 技术方案概要

### 6.1 交付形态：**单包双端 bundle**

```
vision-bridge/
├── package.json           # main: lib/index.js; exports: { ".": lib/index.js, "./client": lib/client.js,
│                          #   "./cordis.patch.yml": ... }; dsh: { bundle: { patch }, client: { platform: 'web', inject: [...] } }
├── cordis.patch.yml       # - insert: [{ id: vision-bridge, name: '@deepseek-ai/dsh-vision-bridge' }]
│                          #   （一行即可：client-modules 扫描该 loader 行 → 包声明 dsh.client → 服务 lib/client.js）
├── tsconfig.json / tsdown.config.ts   # host 面 → lib/index.js；client 面 → lib/client.js（closure-factory，tsdown.client.ts 副本）
├── src/
│   ├── index.ts           # host 插件：视觉编排 + vision_describe + webServer 路由（按编译产物重建）
│   ├── vision.ts          # OpenAI 兼容视觉调用（按编译产物重建）
│   ├── config.ts          # settings 命名空间 + schema（按编译产物重建）
│   ├── adapter.ts         # 包装适配器：inputModalities 声明 + stream() 私有请求改写（FR0）
│   ├── model-messages.ts  # 模型消息副本改写 + 按附件缓存
│   ├── description-policy.ts # 意图优先提示词 + 低信息重试
│   ├── turn-guard.ts      # 同轮附件工具调用保护
│   ├── invariant.ts       # invariants 伴生（按编译产物重建）
│   └── client/
│       ├── index.tsx      # slots 注册：shell.overlay 面板 + sidebar.footer.action 开关 + tool.call.toolview 卡片
│       ├── store.ts       # defineStore：{open} + toggle/close
│       ├── VisionBridgePanel.tsx / VisionBridgeToggle.tsx / VisionDescribeCard.tsx
│       ├── locales.ts     # zh/en（参考实现全量文案）
│       └── *.module.css   # 新建（参考实现未保留 CSS）
```

### 6.2 复用资产清单

| 资产 | 位置 | 用途 |
|---|---|---|
| Host 半编译产物 | `packages/extensions/vision-bridge/lib/types/*.js` | 重建 host 逻辑的直接依据（源码可逆推） |
| Client 半编译产物 | `packages/client/ui-vision-bridge/lib/types/client/*.js` | 重建面板/卡片/文案的直接依据 |
| attachments 服务 | `packages/attachment`（`ctx.attachments.readImage`） | 按引用读图片字节 |
| settings / credentials | `packages/settings`、`packages/credentials` | 配置与密钥（credential-ref） |
| webServer | `packages/webserver`（`ctx.webServer.register`） | Host HTTP 路由 |
| 浏览器 API | `ctx.connection.api`（settings/credentials/sessions.attachment） | 面板读写与缩略图 |
| client bundle 构建 | `packages/client/tsdown.client.ts`、`packages/client/AGENTS.md` | 预构建 `lib/client.js` 协议（副本） |
| bundle 打包规范 | `docs/user/develop/basic/publish.md`、`packages/bundle/base/package.json` | `dsh.bundle` 声明与安装 |
| 双端加载验证 | `packages/client/modules/src/index.ts`、`modules/tests/node-half.client.spec.ts` | 第三方 client 包加载可行性依据 |

### 6.3 关键决策记录（ADR）

| # | 决策点 | 决策 | 理由 |
|---|---|---|---|
| ADR-1 | 面板槽位 | `shell.overlay`（list，叠加，id `vision-bridge-panel`，order 100） | 参考实现同款；`details` 被 ui-conversation 占用会挤掉工具详情 |
| ADR-2 | 面板数据获取 | 轮询 `/recent` + 手动刷新 | 第三方 bundle 无法改 `remote-events` 白名单；recent 为纯展示数据 |
| ADR-3 | api_key 存储 | credentials 引用（env `VISION_API_KEY`），settings 只存 url/model/apiKeyEnv | 安全约束；参考实现同款 |
| ADR-4 | 触发方式 | adapter 自动描述 + `vision_describe` 工具并存 | 自动描述只发生在模型请求边界；工具仅用于后续追问，同轮调用直接复用缓存 |
| ADR-5 | 面板开合 | store seat actions（defineStore），不扩展 layout 服务 | 第三方 bundle 不得改仓库内服务 |
| ADR-6 | 交付形态 | 单包双端（exports "." + "./client" + dsh.client），patch 插一行 | 与 ui-cordis 同构；client-modules 扫描 loader 行即可发现 |
| ADR-7 | 主模型未来支持视觉 | 面板可加"启用/禁用"（P1 增强） | 防功能冗余 |
| ADR-8 | 图片入站使能 | 注册包装适配器（inputModalities 追加 image + stream 私有改写） | 同时跨过上传与序列化门槛，并隔离 durable/UI 消息与模型上下文 |

---

## 7. 验收标准（AC）

1. **AC1**：`dsh plugin --profile <name> add <包>` 安装成功；`dsh --profile <name> --dump-config` 可见补丁层；**重启后** Web 启动无报错，侧栏出现"视觉桥接"开关，点击出现右侧浮动面板。
2. **AC2**：面板填写 url/model/api_key → 测试连接 → 返回 ok + latency（真实或本地 mock 端点）。
3. **AC3**：配置成功后发一张图片 → 聊天气泡保留原始图片和用户原话，不出现 `[视觉描述]`/附件 ID → 模型回复体现图片信息；同轮工具复用缓存，面板仅出现一张描述卡片。
4. **AC4**：后续追问"图中 XX 是什么"且已有描述不足 → 模型调用 `vision_describe` → 对话出现"视觉桥接"结果卡片；面板更新该附件原记录且不产生重复卡片。
5. **AC5**：未配置时发图 → 可见消息仍为原图；仅模型私有副本出现 `[视觉描述失败]` 占位，模型正常继续，不崩溃。
6. **AC6**：错误映射正确（401→AUTH、429→RATE_LIMIT、超时→TIMEOUT 等），面板展示错误码。
7. **AC7**：`npm pack` 产物可被 `dsh plugin add ./x.tgz` 安装；浏览器 Network 出现 `/plugins/<scope>/<name>/client.js` 请求。
8. **AC8**：api_key 不出现在 settings 明文、日志、前端读回、模型上下文；`/vision-bridge/test` 错误响应不含凭证。

---

## 8. 风险与开放问题

| # | 风险 | 等级 | 缓解/结论 |
|---|---|---|---|
| R1 | 第三方 client bundle 运行时加载 | 低（已缓解） | `client-modules` 按 baseUrl require 解析 loader 条目，`@fixture/*` 测试佐证；仍需端到端实测 |
| R2 | client bundle 构建协议未发布 | 中 | 自备 `tsdown.client.ts` 协议副本；react 保持 external；CSS Modules 由 lightningcss 注入 |
| R3 | `vision_describe` 依赖进程内 `refs` Map | 中 | 附件 id 会话内有效；重启后追问需重新发图；可接受（首版），P1 可考虑持久化 |
| R4 | 大图/多图性能 | 中 | 依赖 `readImage` 体积限制；多图逐图描述；首版接受 |
| R5 | git 安装缺预构建产物 | 中 | 用 `prepare` 脚本或发布 tarball/npm（publish.md 结论）；`MissingClientBundleError` 提示需重启 |
| R6 | 主模型未来支持视觉 | 低 | 面板"启用/禁用"开关（P1） |
| R7 | 在 pre-step 改写会污染 durable `user/message` 并泄漏内部描述 | 高（已修复） | FR0 adapter 的 stream 是唯一图片改写边界；回归测试断言原始消息对象保持 ImageBlock |

**开放问题（P1 再议，不阻塞首版）**：
- OQ-1：`/recent` 是否按会话隔离（当前 host 内存、全局共享）。
- OQ-2：面板是否加自动轮询间隔（当前打开时加载 + 手动刷新）。
- OQ-3：是否为 adapter 自动描述增加独立的非消息型状态指示（当前只进面板历史，不污染对话流）。

---

## 9. 里程碑

| 里程碑 | 内容 | 交付物 |
|---|---|---|
| M1 | Host 半重建 | `src/{index,vision,config,invariant}.ts`（按编译产物逆推）+ host 单测 |
| M2 | Client 半重建 | `src/client/*`（面板/开关/卡片/文案，按编译产物逆推）+ `*.module.css` + 组件测试 |
| M3 | Bundle 打包与验证 | package.json/cordis.patch.yml/tsdown（双端）；`dsh plugin` 本地安装 + `--dump-config` + 发图 e2e |
| M4 | 发布（可选） | `npm publish` + GitHub `dsh-plugin` topic |

---

## 10. 附录

### 10.1 参考实现编译产物（重建依据，gitignored 未入库）

- Host：`packages/extensions/vision-bridge/lib/types/{index,vision,config,invariant}.js`
- Client：`packages/client/ui-vision-bridge/lib/types/client/{index,store,VisionBridgePanel,VisionBridgeToggle,VisionDescribeCard,locales}.js`
- 备注：`lib/` 被 `.gitignore:4` 忽略；两者均无 package.json/tsconfig/src，需重建。

### 10.2 面板 i18n 文案（zh，参考实现 locales.js，可直接采用）

`视觉桥接 / 主模型无视觉能力时，将图片转发到已配置的视觉模型进行描述。 / 接口地址 / 模型名称 / API Key / 仅填写一次，保存后不再回显 / 保存配置 / 测试连接 / 刷新 / 已保存 / 未配置视觉模型 / 测试中… / 连接成功（{latency} ms）/ 连接失败：{message} / API Key 已配置 / 剩余额度 / 最近描述 / 附件 {id}`（en 全量见 `locales.js`）。

### 10.3 关键参考文件

- 官方插件教程：`docs/user/develop/basic/{index,tool,config,publish}.md`
- 架构/缝：`docs/architecture.md`、`docs/capability-seams.md`、`docs/cordis-primer.md`
- 客户端：`packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`、`packages/client/ui-settings-models/src/client/{ProviderEditor,ModelListEditor}.tsx`、`packages/client/ui-settings/src/client/settings-scope.ts`、`packages/client/tsdown.client.ts`、`packages/client/modules/src/index.ts`、`packages/client/ui-layout/src/client/index.ts`
- 安装机制：`apps/cli/src/plugin.ts`、`packages/boot/app-boot/src/profile.ts`、`apps/cli/reference/README.md`
- 探讨子代理报告：`vision-bridge-client-feasibility.md`（工作区）、双端打包报告（会话内交付）、Host 侧报告与参考实现盘点（会话内交付）
- 关键源码锚点：`packages/host/apiproxy/src/api-proxy.ts:2482-2494`（图片上传门槛）、`llm-deepseek/src/adapter.ts:113` + `serialize.ts:63-68`（文本模型拒绝图片）、`packages/llm/llm/src/index.ts:338-367`（registerAdapter）、`packages/web/web-search-deepseek/src/index.ts:95-137`（settings+credentials 插件范式）
