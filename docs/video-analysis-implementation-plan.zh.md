# 视频解析实施计划

本计划实现 [视频解析服务设计](./video-analysis-design.zh.md)。所有代码仅落在 `dsh-visual-plugin`；不得修改 DeepSeek Harness 源码。每一阶段都应保持图片桥可构建、可测试、可发布，并以小提交落地。

## 实施原则

- 将视频能力拆成 host 深模块与 client 深模块，不继续堆叠 `src/index.ts` 或 `VisionBridgePanel.tsx`。包入口只暴露安装接口，媒体参数、存储布局和状态转换留在实现内部。
- 先定义领域状态和纯逻辑，再接文件系统、进程、HTTP 与 React。
- 外部命令统一经过一个无 shell 的受控进程运行器。
- 每个持久化阶段先写临时产物，复验后原子提交；重启只能重做幂等阶段。
- 以 `VideoCoordinator` 的命令/快照接口作为主测试面；HTTP、工具和 UI 都是该 seam 的 adapter，不在各自调用点重复策略。
- 只在存在生产与测试两种 adapter 时建立内部 seam。文件持久化测试使用真实临时目录，避免为单一实现制造浅层抽象。
- `lib/` 只由构建生成，但作为 npm 发布物随源码提交。

## 阶段 0：基线与测试夹具

目标：建立视频功能的回归边界，不改变运行行为。

- 记录现有 `npm test`、`npm run typecheck`、`npm run build` 和 `npm pack --dry-run` 基线。
- 增加用 FFmpeg `lavfi` 在测试时生成的小视频夹具脚本，覆盖 MP4、MOV、AVI、MPEG、MKV、WebM、VFR、旋转、Alpha、隔行、HDR 标记、双视频轨和损坏尾部。
- 把依赖不可用的测试与真实集成测试分组，确保普通贡献者没有 FFmpeg 时仍能运行单元测试。

验收：现有图片测试零变化；生成夹具不进入 npm 包。建议提交：`test: scaffold video integration fixtures`。

## 阶段 1：领域模型、配置与清单

目标：先固化状态机、限制和持久化协议。

- 新建 `src/video/index.ts`、`coordinator.ts`、`types.ts`、`config.ts`、`errors.ts`、`manifest.ts`、`store.ts`；`src/video/index.ts` 只导出安装接口。
- 定义视频 ID、会话归属、阶段状态、容器家族、探测信息、帧、分析版本、错误码和配置快照。
- 定义 `VideoCoordinator` 的小接口：命令输入、不可变任务快照和可取消的上传写入，不暴露清单或子进程类型。
- 实现版本化 JSON 清单、原子写入、恢复、迁移、`0700/0600` 权限、Windows ACL 适配点、目录锁和陈旧锁回收。
- 增加最终配额、临时空间预估、固定 7 天 TTL、LRU 和同会话 SHA-256 索引的纯逻辑测试。

验收：坏清单不会导致数据丢失；迁移可重复执行；所有限制同时覆盖默认值和硬上限。建议提交：`feat(video): add versioned job and storage model`。

## 阶段 2：受控进程与依赖探测

目标：为所有媒体命令建立唯一安全边界。

- 新建 `src/video/process-runner.ts` 和 `capabilities.ts`。
- 使用 `spawn(executable, args, { shell: false })`；限制环境、stderr、超时、线程和进程树，支持 AbortSignal。
- 实现 Linux/macOS/Windows 的温和终止、强制终止和 RSS 看门狗。
- 探测 FFmpeg/FFprobe 版本一致性、编码器、滤镜、PySceneDetect 版本/命令、NVENC 单帧能力。
- 提供结构化健康结果，视频不可用时不抛出插件级致命错误。

验收：模拟挂起、超限、父进程退出和子进程残留；确认只终止已解析 PID。建议提交：`feat(video): add bounded media process runner`。

## 阶段 3：上传 API 与输入鉴别

目标：安全地把浏览器文件落入插件暂存区。

- 新建 `src/video/http.ts`、`upload.ts`、`signature.ts`、`probe.ts`。
- 采用两步同源协议：先提交会话、文件名、大小和 MIME 元数据以创建随机 upload ID，再 PUT 原始字节流。
- 流式计数、SHA-256、取消和临时空间监控；拒绝声明大小与实际大小不符。
- 实现八类扩展名的签名、FFprobe 和家族映射交叉验证；MIME 只记录不裁决。
- 校验主视频轨、时长、分辨率、DRM/加密、附图轨和多轨歧义。
- 路由校验同源来源、会话存在性、随机 ID 和状态转移，避免路径穿越、CSRF 和跨会话枚举。

验收：改后缀、空 MIME、伪 MIME、WebM/Matroska 混淆、音频-only、双默认轨、超限和中断上传均有稳定错误码且无残留。建议提交：`feat(video): stream and validate plugin-owned uploads`。

## 阶段 4：标准化管线

目标：输出唯一、可验证、可播放的媒体规范。

- 新建 `src/video/transcode.ts`、`filters.ts`、`verify-output.ts`。
- 根据探测结果组合去隔行、旋转、Alpha 扁平、HDR→SDR、缩放、偶数尺寸和限帧滤镜。
- CPU 基线使用 `libx264`；NVENC 仅在显式实验设置和真实探测通过时使用，失败自动回退 CPU。
- 输出无音频 MP4/H.264/yuv420p/CRF 26/faststart，并执行完整后置 FFprobe 与时长校验。
- 使用 `-progress` 解析进度，所有临时输出与最终目录位于同一文件系统。

验收：输出属性逐项断言；损坏尾部不能产生可提交产物；HDR 缺滤镜给出可执行安装指引。建议提交：`feat(video): normalize uploads to verified h264 mp4`。

## 阶段 5：场景检测与关键帧

目标：稳定地产生有代表性且有预算约束的帧集合。

- 新建 `src/video/scenes.ts`、`keyframes.ts`、`dedupe.ts`。
- 在标准化视频上调用 PySceneDetect Adaptive/Threshold 检测器，解析结构化输出并合并邻近边界。
- 实现低/标准/高预设、首尾帧、场景中点、长场景 10 秒补帧、场景分数优先及时间分层裁剪。
- 以 pHash + 像素相似度保守去重。
- 从标准化视频提取普通帧，从原视频同时间点提取最多 48 张高清帧；全部复验后删除原视频。

验收：静态录屏、快速运镜、渐变、闪切、幻灯片小字变化和单帧视频均得到确定结果；原件只在高清帧提交后删除。建议提交：`feat(video): detect scenes and persist bounded keyframes`。

## 阶段 6：持久队列与生命周期

目标：把媒体阶段组织成可取消、可恢复的任务。

- 新建 `src/video/queue.ts`、`job-runner.ts`、`cleanup.ts`。
- 默认 1 活动/5 等待，活动并发可调至 2；每个阶段写入开始、进度、完成和错误边界。
- 实现启动恢复、一次 FFmpeg 中断重试、确定性错误不重试、取消、会话删除、到期和无主任务清理。
- 清理顺序为过期→LRU；活动、播放、当前引用任务持有租约，清理必须等待或取消租约。

验收：在每个状态强制终止进程后重启，不能出现重复提交、越权复用或孤立大文件。建议提交：`feat(video): add recoverable processing queue`。

## 阶段 7：视觉分析与 DSH 证据汇总

目标：完成“看帧”和“整理证据”的双模型链路。

- 新建 `src/video/vision-analysis.ts`、`analysis-schema.ts`、`text-summary.ts`、`prompt-boundary.ts`。
- 复用现有视觉配置与凭据解析；实现 6 帧批次、2 批并发、单图回退、指数退避、部分完成和失败批次重试。
- 严格校验 JSON；修复重试一次后保存受限自由文本。
- 注入 `agentDefaultModel`，优先读取 `agent.session.requestHeader()?.config`，空白会话读取默认选择。
- 通过 `ctx.llm.stream()` 发起无工具、无会话历史的一次性文本调用；收集文本块、验证结构并提供本地摘要降级。
- 缓存键纳入视频/帧哈希、问题哈希、视觉模型、提示词版本和 DSH 汇总路由。

验收：辅助调用不写 Session event，不触发 Agent turn；提示注入测试证明视频文字只能作为数据；更换模型不会复用旧缓存。建议提交：`feat(video): analyze frames and summarize with dsh model`。

## 阶段 8：工具、引用与播放接口

目标：让正常会话按需追问并让浏览器可靠播放。

- 注册 `video_describe(videoId, prompt, start?, end?)`，严格验证所属会话、时间范围、保留期和每次 12 帧预算。
- 增加列表、详情、分析、重试、取消、删除、诊断导出和内容路由。
- 内容路由实现 GET/HEAD、单 Range、206/416、ETag、inline、nosniff 和正确 Content-Length。
- 删除/到期保留最小 tombstone，使旧工具引用得到稳定错误而非模糊 404。

验收：跨会话访问拒绝；随机/恶意 ID 无路径影响；Safari/Chrome/Firefox 可拖动进度条；删除后链接失效。建议提交：`feat(video): add scoped tool and range playback`。

## 阶段 9：输入区与右侧面板 UI

目标：在不改 DSH 的情况下完成端到端交互。

- 将面板拆为图片视图和视频视图；顶部新增双选择卡，保留现有图片历史行为。
- 在 `conversation.input.left` 注册上传按钮，在 `conversation.input.dock` 注册上传/处理进度、待分析问题和显式视频引用。
- 视频卡实现播放器、时间线 seek、状态、部分结果、历史折叠、复制、重试、取消和删除确认。
- 使用公开 `InputActions.setDraft()` 写入问题、视频引用和证据摘要，不调用 `submit()`。
- 增加完整中英文 locale、键盘导航、焦点管理、Reduced Motion 和窄屏布局。

验收：切换会话、关闭面板、刷新、等待后台完成和编辑问题均保持正确归属；状态徽标不抢占当前面板。建议提交：`feat(video): add upload dock and analysis panel`。

## 阶段 10：发布门禁与文档

目标：安全发布 Beta，并为稳定版保留明确出口。

- 更新 README/README.zh：依赖安装、支持格式、隐私、保留、限制、故障排查和卸载清理。
- 增加 CI：三平台单元/类型/构建，Linux FFmpeg + PySceneDetect 真实集成，npm pack 校验。
- 校验 npm 包不携带测试视频、临时数据、Python 环境或密钥。
- 生成并提交最新 `lib/index.js`、`lib/client.js`、声明文件。
- 发布 `0.3.0-beta.1` 到 npm `beta` dist-tag，并创建同版本 GitHub prerelease；不得移动 `latest`。

验收命令：

```bash
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

建议提交顺序：`docs:` → 各阶段 `feat(video):`/`test:` → `docs:` → `chore: bump version to 0.3.0-beta.1`。发布前必须确认工作树仅包含预期源码、测试、文档和再生构建物。

## 稳定版退出条件

- Beta 安装、升级和卸载路径在 Linux、macOS、Windows 实机通过。
- 图片上传、自动描述、历史卡片和 `vision_describe` 无回归。
- 支持容器、伪装格式、HDR、Alpha、隔行、VFR、多轨、截断和极短视频均有覆盖。
- 任务恢复、取消、会话删除、TTL、LRU、目录锁、磁盘/内存/超时限制均通过故障注入。
- 无未解决的 P0/P1 数据泄露、越权读取、磁盘破坏、进程泄漏或发布问题。
- 之后才发布 `0.3.0` 并将 npm `latest` 指向该稳定版本。
