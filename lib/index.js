import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { SessionId } from "@deepseek-ai/dsh-session/types";
import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { LlmAdapter } from "@deepseek-ai/dsh-llm";
import { appendFile, chmod, copyFile, mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
//#region src/config.ts
/**
* Vision-bridge user configuration: the OpenAI-compatible vision endpoint the
* bridge forwards user images to. Lives in the `vision-bridge` settings
* namespace so the web panel can read and write it through the standard
* settings seam; the API key itself is a credential reference, never a
* settings value.
* @module dsh-visual-plugin/config
*/
/** The settings namespace this plugin owns. */
const NS = settingsNamespace("vision-bridge");
/** Default credential reference the panel stores the API key under. */
const DEFAULT_API_KEY_ENV = "VISION_API_KEY";
/** The `vision-bridge` settings section schema. */
const VisionBridgeConfig = z.object({
	url: z.string().default(""),
	model: z.string().default(""),
	apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
	historyLimit: z.number()
});
//#endregion
//#region src/vision.ts
/**
* OpenAI-compatible vision calls over the Node fetch global: describe an
* image, ping a connection, and query a provider's remaining balance.
* Every request carries `Authorization: Bearer` and never follows redirects
* (a 3xx is a failure, not a credential leak vector). Errors normalize to a
* stable code vocabulary the model and the panel can both react to.
* @module dsh-visual-plugin/vision
*/
/** Maximum milliseconds a vision call may run before aborting. */
const DEFAULT_VISION_TIMEOUT_MS = 6e4;
/** Internal marker so callers can rethrow the normalized form. */
var VisionError = class extends Error {
	code;
	statusCode;
	constructor(code, message, statusCode) {
		super(message);
		this.code = code;
		this.statusCode = statusCode;
	}
};
/** Stable error vocabulary for vision-API failures. */
const CODE_FOR_STATUS = {
	401: "AUTH",
	403: "AUTH",
	429: "RATE_LIMIT",
	402: "QUOTA"
};
/** Extract a safe message from an unknown thrown value. */
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
/** Build a normalized error with optional provider body details. */
function visionError(code, message, statusCode, body) {
	return new VisionError(code, statusCode === void 0 ? message : `${message}${body === void 0 || body.length === 0 ? "" : ` Body: ${body}`}`, statusCode);
}
/** Parse a non-2xx response into a normalized {@link VisionCallError}. */
async function httpError(response) {
	const statusCode = response.status;
	const code = CODE_FOR_STATUS[statusCode] ?? "HTTP";
	let body = "";
	try {
		body = (await response.text()).slice(0, 500);
	} catch {}
	return visionError(code, `Vision API returned HTTP ${statusCode}.`, statusCode, body);
}
/** Normalize any thrown value to a {@link VisionCallError}. */
function normalize(error) {
	if (error instanceof VisionError) {
		const normalized = {
			code: error.code,
			message: error.message
		};
		if (error.statusCode !== void 0) normalized.statusCode = error.statusCode;
		return normalized;
	}
	return {
		code: "NETWORK",
		message: errorMessage(error)
	};
}
/** Append `/chat/completions` to a base URL that does not already end there. */
function completionsUrl(baseUrl) {
	const trimmed = baseUrl.replace(/\/+$/, "");
	return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}
/** Coerce an unknown JSON number field, defaulting when absent or non-numeric. */
function numberOr(value, fallback) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
/**
* OpenAI-compatible request facts for one image.
* @param data - base64-encoded image bytes.
* @param mediaType - image media type, e.g. `image/png`.
*/
function imageDataUrl(data, mediaType) {
	return `data:${mediaType};base64,${data}`;
}
/**
* Read a JSON response and normalize a failure to a {@link VisionCallError},
* sanitizing any echoed credential material.
* @param url - full chat completions endpoint.
* @param apiKey - bearer credential.
* @param model - model name to request.
* @param messages - OpenAI-format message payload.
* @param signal - optional abort signal forwarded to the request.
*/
async function callChatCompletions(url, apiKey, model, messages, signal) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), DEFAULT_VISION_TIMEOUT_MS);
	const onOuterAbort = () => controller.abort();
	signal?.addEventListener("abort", onOuterAbort, { once: true });
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model,
				messages,
				max_tokens: 1024
			}),
			redirect: "manual",
			signal: controller.signal
		});
		if (response.status >= 300) throw await httpError(response);
		const json = await response.json();
		const content = json.choices?.[0]?.message?.content;
		if (typeof content !== "string" || content.length === 0) throw visionError("PROTOCOL", "Vision API returned no text content.");
		const result = { content };
		const usage = json.usage;
		if (usage !== void 0) result.usage = {
			promptTokens: numberOr(usage.prompt_tokens, 0),
			completionTokens: numberOr(usage.completion_tokens, 0),
			totalTokens: numberOr(usage.total_tokens, 0)
		};
		return result;
	} catch (error) {
		if (error instanceof VisionError) throw error;
		if (controller.signal.aborted) throw visionError("TIMEOUT", "Vision API request timed out.");
		throw visionError("NETWORK", `Vision API request failed: ${errorMessage(error)}`);
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", onOuterAbort);
	}
}
/**
* Ping a chat-completions endpoint with a minimal text prompt.
* @param baseUrl - endpoint base; `/chat/completions` is appended when absent.
* @param apiKey - bearer credential.
* @param model - model name to test.
* @param signal - optional abort signal.
*/
async function testConnection(baseUrl, apiKey, model, signal) {
	const started = Date.now();
	try {
		const result = await callChatCompletions(completionsUrl(baseUrl), apiKey, model, [{
			role: "user",
			content: "ping"
		}], signal);
		return {
			ok: true,
			latencyMs: Date.now() - started,
			echo: result.content.trim()
		};
	} catch (error) {
		return {
			ok: false,
			latencyMs: Date.now() - started,
			error: normalize(error)
		};
	}
}
/**
* Describe one image through an OpenAI-compatible vision endpoint.
* @param baseUrl - endpoint base; `/chat/completions` is appended when absent.
* @param apiKey - bearer credential.
* @param model - vision-capable model name.
* @param data - base64 image bytes.
* @param mediaType - image media type.
* @param prompt - optional instruction overriding the default "describe" ask.
* @param signal - optional abort signal.
*/
async function describeImage(baseUrl, apiKey, model, data, mediaType, prompt, signal) {
	const messages = [{
		role: "user",
		content: [{
			type: "text",
			text: prompt ?? "Describe this image in detail, including any visible text."
		}, {
			type: "image_url",
			image_url: { url: imageDataUrl(data, mediaType) }
		}]
	}];
	const result = await callChatCompletions(completionsUrl(baseUrl), apiKey, model, messages, signal);
	const describe = { description: result.content };
	if (result.usage !== void 0) describe.usage = result.usage;
	return describe;
}
/** Describe an ordered set of images in one OpenAI-compatible multimodal request. */
async function describeImages(baseUrl, apiKey, model, images, prompt, signal) {
	if (images.length === 0) throw new Error("at least one image is required");
	const content = [{
		type: "text",
		text: prompt
	}, ...images.map((image) => ({
		type: "image_url",
		image_url: { url: imageDataUrl(image.data, image.mediaType) }
	}))];
	const result = await callChatCompletions(completionsUrl(baseUrl), apiKey, model, [{
		role: "user",
		content
	}], signal);
	return {
		description: result.content,
		...result.usage === void 0 ? {} : { usage: result.usage }
	};
}
/** Derive a provider balance probe from the endpoint base, or undefined. */
function balanceProbe(baseUrl) {
	const base = baseUrl.replace(/\/+$/, "");
	if (baseUrl.includes("deepseek.com")) return {
		url: `${base}/user/balance`,
		parse: (json) => {
			const infos = json.balance_infos;
			if (!Array.isArray(infos)) return [];
			return infos.map((info) => {
				const row = info;
				return {
					currency: String(row.currency ?? ""),
					total: numberOr(row.total_balance, 0),
					available: numberOr(row.granted_balance, 0),
					used: numberOr(row.topped_up_balance, 0)
				};
			});
		}
	};
	if (baseUrl.includes("siliconflow.cn")) return {
		url: `${base}/v1/user/info`,
		parse: (json) => {
			const data = json.data;
			if (typeof data !== "object" || data === null) return [];
			const row = data;
			return [{
				currency: "CNY",
				total: numberOr(row.totalBalance, 0),
				available: numberOr(row.balance, 0),
				used: numberOr(row.chargeBalance, 0)
			}];
		}
	};
	if (baseUrl.includes("moonshot") || baseUrl.includes("kimi")) return {
		url: `${base}/v1/users/me/balance`,
		parse: (json) => {
			const data = json.data;
			if (typeof data !== "object" || data === null) return [];
			const row = data;
			return [{
				currency: "CNY",
				total: numberOr(row.cash_balance, 0),
				available: numberOr(row.available_balance, 0),
				used: numberOr(row.voucher_balance, 0)
			}];
		}
	};
}
/**
* Query a provider's remaining balance when it exposes a known endpoint.
* Recognized: DeepSeek `/user/balance`, SiliconFlow `/v1/user/info`,
* Moonshot `/v1/users/me/balance`. Unknown endpoints report unsupported.
* @param baseUrl - endpoint base used to derive the balance path.
* @param apiKey - bearer credential.
* @param signal - optional abort signal.
*/
async function queryBalance(baseUrl, apiKey, signal) {
	const probe = balanceProbe(baseUrl);
	if (probe === void 0) return { supported: false };
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), DEFAULT_VISION_TIMEOUT_MS);
	const onOuterAbort = () => controller.abort();
	signal?.addEventListener("abort", onOuterAbort, { once: true });
	try {
		const response = await fetch(probe.url, {
			method: "GET",
			headers: { "Authorization": `Bearer ${apiKey}` },
			redirect: "manual",
			signal: controller.signal
		});
		if (response.status >= 300) throw await httpError(response);
		const json = await response.json();
		return {
			supported: true,
			lines: probe.parse(json)
		};
	} catch (error) {
		return {
			supported: true,
			error: normalize(error)
		};
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", onOuterAbort);
	}
}
//#endregion
//#region src/adapter.ts
/** The provider route this wrapper owns; users select it in the model picker. */
const VISION_PROVIDER = "deepseek-vision";
/** The provider route owned by the shipped deepseek adapter. */
const UNDERLYING_PROVIDER = "deepseek-official";
/**
* Register the wrapper adapter for {@link VISION_PROVIDER} when the llm seam
* is present. The registration is effect-bound and disposes with the fiber.
* @param ctx - plugin context.
*/
function registerVisionAdapter(ctx, rewrite) {
	const llm = ctx.get("llm");
	if (llm === void 0) return;
	llm.registerAdapter([VISION_PROVIDER], new VisionBridgeAdapter(ctx, rewrite));
}
/** The wrapper: image-input admission plus delegated deepseek streaming. */
var VisionBridgeAdapter = class extends LlmAdapter {
	ctx;
	rewrite;
	constructor(ctx, rewrite) {
		super();
		this.ctx = ctx;
		this.rewrite = rewrite;
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: "DeepSeek (Vision)"
		};
	}
	listModels(provider) {
		return this.ctx.llm.listModels(UNDERLYING_PROVIDER).then((models) => models.map((model) => ({
			...model,
			provider
		})));
	}
	resolveModel(provider, model, signal) {
		return this.ctx.llm.resolveModelInfo(UNDERLYING_PROVIDER, model, signal).then((info) => ({
			...info,
			provider,
			inputModalities: [...info.inputModalities ?? [], "image"]
		}));
	}
	async *stream(options) {
		const rewritten = await this.rewrite(options.messages, {
			signal: options.signal,
			sessionId: options.sessionId === void 0 ? void 0 : String(options.sessionId)
		});
		const delegated = rewritten === options.messages ? {
			...options,
			provider: UNDERLYING_PROVIDER
		} : {
			...options,
			provider: UNDERLYING_PROVIDER,
			messages: rewritten
		};
		yield* this.ctx.llm.stream(delegated);
	}
};
//#endregion
//#region src/recent.ts
/**
* Retain a completed description under its image group, keyed by
* `(sessionId, attachmentId)` so each conversation's history is isolated.
*
* Re-describing an image moves that group to the front, exposes the new answer
* as its latest description, and retains the older intent-specific answers in
* that same group. Both image groups and per-image descriptions are bounded;
* a `null` per-image limit keeps the history unbounded.
*/
function recordRecent(recent, entry, maxImages, maxDescriptionsPerImage) {
	const existingIndex = recent.findIndex((item) => item.attachmentId === entry.attachmentId && item.sessionId === entry.sessionId);
	const existing = existingIndex < 0 ? void 0 : recent[existingIndex];
	if (existingIndex >= 0) recent.splice(existingIndex, 1);
	const descriptions = existing?.descriptions ?? [];
	descriptions.unshift({
		time: entry.time,
		description: entry.description
	});
	if (maxDescriptionsPerImage !== null && descriptions.length > maxDescriptionsPerImage) descriptions.length = maxDescriptionsPerImage;
	const sessionId = entry.sessionId ?? existing?.sessionId;
	recent.unshift({
		attachmentId: entry.attachmentId,
		updatedAt: entry.time,
		descriptions,
		...sessionId === void 0 ? {} : { sessionId }
	});
	if (recent.length > maxImages) recent.length = maxImages;
}
//#endregion
//#region src/description-policy.ts
/** Build an intent-first prompt that treats OCR as supporting detail. */
function visionPromptFor(userText) {
	return `${userText.trim().length === 0 ? "用户没有附加问题，请概括图片的主要内容。" : `用户针对这张图片提出的问题：${userText.trim()}`}\n请直接回答用户问题，并先说明图片中的主要物体、人物或场景，以及相关动作和用途。不要只回答图片中是否有文字；如果存在可读文字，再在内容说明后完整列出。`;
}
/** Whether a nominally successful answer carries no useful visual content. */
function isLowInformationDescription(description) {
	const text = description.trim().replace(/\s+/g, " ");
	if (text.length === 0) return true;
	return [
		/^(?:图片|图像|画面)?中?(?:没有|未发现|看不到|不包含).*?(?:文字|文本)[。.!]?$/,
		/^(?:无法|不能)(?:识别|判断|看清|描述).*?[。.!]?$/,
		/^(?:there (?:is|are)|the image (?:has|contains)) no (?:visible )?text[.!]?$/i,
		/^(?:unable|cannot) to (?:identify|determine|describe).*?[.!]?$/i
	].some((pattern) => pattern.test(text));
}
/** Run one vision request and retry once when it returns an OCR-only non-answer. */
async function describeWithLowInformationRetry(run, userText) {
	const prompt = visionPromptFor(userText);
	const first = await run(prompt);
	if (!isLowInformationDescription(first.description)) return first;
	return run(`${prompt}\n上一次回答信息不足，只说明了是否存在文字。请重新分析整张图片并直接回答用户问题。`);
}
//#endregion
//#region src/model-messages.ts
var DescriptionFailure = class extends Error {
	displayText;
	constructor(displayText, options) {
		super(displayText, options);
		this.displayText = displayText;
	}
};
/** Extract the user's question/intent from one message. */
function userTextOf(message) {
	return message.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim();
}
/**
* Rewrites images only at the outbound model boundary.
*
* Durable session messages remain untouched, while repeated model steps reuse
* the first successful automatic description for each attachment.
*/
var ModelImageBridge = class {
	pending = /* @__PURE__ */ new Map();
	resolved = /* @__PURE__ */ new Map();
	options;
	nextOperation = 0;
	constructor(options) {
		this.options = options;
	}
	/** Return a completed automatic description without starting new work. */
	cachedDescription(attachmentId) {
		return this.resolved.get(attachmentId);
	}
	/** Seed the cache with a previously persisted description (startup restore). */
	seedResolved(attachmentId, description) {
		this.resolved.set(attachmentId, description);
	}
	/** Build model-bound copies of messages containing image blocks. */
	async rewrite(messages, context = {}) {
		let changed = false;
		const rewritten = await Promise.all(messages.map(async (message) => {
			const messageId = typeof message.id === "string" ? String(message.id) : void 0;
			const result = await this.rewriteContent(message.content, userTextOf(message), context, messageId);
			if (!result.changed) return message;
			changed = true;
			return {
				...message,
				content: result.content
			};
		}));
		return changed ? rewritten : messages;
	}
	/** Rewrite images at every core content depth, including read_image tool results. */
	async rewriteContent(content, userText, context, messageId) {
		const results = await Promise.all(content.map(async (block) => {
			if (block.type === "tool-result") {
				const nested = await this.rewriteContent(block.content, userText, context, messageId);
				return nested.changed ? {
					block: {
						...block,
						content: nested.content
					},
					changed: true
				} : {
					block,
					changed: false
				};
			}
			if (block.type !== "image") return {
				block,
				changed: false
			};
			const attachment = block.attachment;
			const attachmentId = String(attachment.attachmentId);
			try {
				return {
					block: {
						type: "text",
						text: `[视觉描述] ${await this.descriptionFor(attachment, userText, context, messageId)}\n[附件] ${attachmentId}\n`
					},
					changed: true
				};
			} catch (error) {
				return {
					block: {
						type: "text",
						text: `[视觉描述失败] ${error instanceof DescriptionFailure ? error.displayText : this.options.failureText(error)}\n[附件] ${attachmentId}\n`
					},
					changed: true
				};
			}
		}));
		return {
			content: results.map((result) => result.block),
			changed: results.some((result) => result.changed)
		};
	}
	async descriptionFor(attachment, userText, context, messageId) {
		const attachmentId = String(attachment.attachmentId);
		const key = attachmentId;
		const resolved = this.resolved.get(key);
		if (resolved !== void 0) return resolved;
		const existing = this.pending.get(key);
		if (existing !== void 0) return existing;
		const operation = {
			operationId: `${Date.now().toString(36)}-${(++this.nextOperation).toString(36)}`,
			attachmentId,
			...context.sessionId === void 0 ? {} : { sessionId: context.sessionId },
			...messageId === void 0 ? {} : { messageId }
		};
		this.options.onStart?.(operation);
		const pending = this.options.describe({
			attachment,
			userText,
			signal: context.signal
		}).then((description) => {
			this.resolved.set(key, description);
			this.options.onDescription({
				...operation,
				description
			});
			return description;
		}, (error) => {
			const displayText = this.options.failureText(error);
			this.options.onFailure?.({
				...operation,
				error: displayText
			});
			throw new DescriptionFailure(displayText, { cause: error });
		});
		this.pending.set(key, pending);
		try {
			return await pending;
		} finally {
			if (this.pending.get(key) === pending) this.pending.delete(key);
		}
	}
};
//#endregion
//#region src/turn-guard.ts
/** Whether a tool call belongs to the turn that first admitted an attachment. */
function isSameTurnAttachmentToolCall(events, attachmentId, callId) {
	let activeTurn;
	let attachmentTurn;
	let callTurn;
	for (const unknownEvent of events) {
		const event = unknownEvent;
		const data = event.data;
		if (event.type === "step/start" && typeof data?.turn === "number") {
			activeTurn = data.turn;
			continue;
		}
		if (event.type === "step/end" && data?.turn === activeTurn) {
			activeTurn = void 0;
			continue;
		}
		if (event.type === "user/message" && activeTurn !== void 0) {
			const content = data?.content;
			if (Array.isArray(content) && content.some((block) => {
				const value = block;
				return value.type === "image" && String(value.attachment?.attachmentId) === attachmentId;
			})) attachmentTurn = activeTurn;
			continue;
		}
		if (event.type === "tool/call" && String(data?.callId) === callId && typeof data?.turn === "number") callTurn = data.turn;
	}
	return attachmentTurn !== void 0 && attachmentTurn === callTurn;
}
//#endregion
//#region src/activity.ts
/** In-memory projection for automatic bridge UI activity. */
var VisionActivityStore = class {
	entries = /* @__PURE__ */ new Map();
	limit;
	now;
	constructor(limit = 100, now = Date.now) {
		this.limit = limit;
		this.now = now;
	}
	/** Begin one operation. Calls without a conversation identity have no inline UI target. */
	start(operation, turn) {
		if (operation.sessionId === void 0) return;
		this.entries.set(operation.operationId, {
			operationId: operation.operationId,
			attachmentId: operation.attachmentId,
			sessionId: operation.sessionId,
			...operation.messageId === void 0 ? {} : { messageId: operation.messageId },
			...turn === void 0 ? {} : { turn },
			status: "running",
			startedAt: this.now()
		});
		this.trim();
	}
	/** Settle one existing operation successfully without creating a duplicate row. */
	complete(operation) {
		this.finish(operation.operationId, {
			status: "completed",
			description: operation.description
		});
	}
	/** Settle one existing operation as failed without creating a duplicate row. */
	fail(operation) {
		this.finish(operation.operationId, {
			status: "failed",
			error: operation.error
		});
	}
	/** Newest-first immutable snapshots for one conversation. */
	forSession(sessionId) {
		return [...this.entries.values()].filter((entry) => entry.sessionId === sessionId).sort((left, right) => right.startedAt - left.startedAt).map((entry) => ({ ...entry }));
	}
	finish(operationId, terminal) {
		const existing = this.entries.get(operationId);
		if (existing === void 0 || existing.status !== "running") return;
		this.entries.set(operationId, {
			...existing,
			...terminal,
			completedAt: this.now()
		});
	}
	trim() {
		while (this.entries.size > this.limit) {
			const oldest = this.entries.keys().next().value;
			if (oldest === void 0) return;
			this.entries.delete(oldest);
		}
	}
};
//#endregion
//#region src/history-store.ts
/**
* Persistent JSONL store for image description history.
*
* One file per image (named by the image's content hash), one JSON record per
* line. The host half appends a line whenever an image is described, and reads
* the whole directory back at startup so restarts reuse prior descriptions
* instead of re-describing old images. Pure Node `fs`, no harness storage seam.
* @module dsh-visual-plugin/history-store
*/
/** Derive the JSONL filename for an attachment id (strip the `algo:` prefix). */
function fileNameFor(attachmentId) {
	return `${attachmentId.replace(/^[^:]+:/, "")}.jsonl`;
}
/**
* Append one description record to the image's JSONL file.
* @param dir - the store directory (e.g. `~/.dsh/.visual_plugin`).
* @param entry - the record to persist.
*/
async function record(dir, entry) {
	await mkdir(dir, { recursive: true });
	await appendFile(join(dir, fileNameFor(entry.attachmentId)), `${JSON.stringify(entry)}\n`);
}
/**
* Load every persisted record across all images, newest-write order unspecified.
* Corrupt lines and unreadable files are skipped, and a missing directory
* yields an empty list (the store is best-effort).
* @param dir - the store directory.
* @returns the flat list of records.
*/
async function load(dir) {
	let files;
	try {
		files = await readdir(dir);
	} catch {
		return [];
	}
	const records = [];
	for (const file of files) {
		if (!file.endsWith(".jsonl")) continue;
		try {
			const text = await readFile(join(dir, file), "utf8");
			for (const line of text.split("\n")) {
				const trimmed = line.trim();
				if (trimmed === "") continue;
				try {
					const parsed = JSON.parse(trimmed);
					if (typeof parsed.attachmentId === "string" && typeof parsed.description === "string") records.push(parsed);
				} catch {}
			}
		} catch {}
	}
	return records;
}
//#endregion
//#region src/video/store.ts
const MANIFEST_VERSION = 1;
const MANIFEST_NAME = "manifest.json";
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
function isSnapshot(value) {
	if (!isRecord(value)) return false;
	return typeof value.videoId === "string" && typeof value.sessionId === "string" && typeof value.fileName === "string" && typeof value.mediaType === "string" && typeof value.sizeBytes === "number" && typeof value.sha256 === "string" && typeof value.status === "string" && typeof value.createdAt === "number" && typeof value.updatedAt === "number" && Array.isArray(value.warnings);
}
function parseManifest(text) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		return;
	}
	if (!isRecord(value) || value.version !== MANIFEST_VERSION || !isSnapshot(value.snapshot)) return void 0;
	return value;
}
/** Restrict one user-owned storage directory on POSIX; chmod is harmlessly best-effort on Windows. */
async function ensurePrivateDirectory(path) {
	await mkdir(path, {
		recursive: true,
		mode: 448
	});
	await chmod(path, 448).catch(() => {});
}
/** Resolve a job directory from an opaque id without permitting nested paths. */
function jobDirectory(rootDir, videoId) {
	if (basename(videoId) !== videoId || !/^video-[a-zA-Z0-9_-]{8,}$/.test(videoId)) throw new Error("invalid video id");
	return join(rootDir, "jobs", videoId);
}
/** Atomically commit one complete manifest. */
async function writeManifest(jobDir, manifest) {
	await ensurePrivateDirectory(jobDir);
	const target = join(jobDir, MANIFEST_NAME);
	const temporary = join(jobDir, `${MANIFEST_NAME}.tmp`);
	const handle = await open(temporary, "w", 384);
	try {
		await handle.writeFile(`${JSON.stringify(manifest)}\n`, "utf8");
		await handle.sync();
	} finally {
		await handle.close();
	}
	await rename(temporary, target);
	await chmod(target, 384).catch(() => {});
}
/** Restore valid manifests and isolate corrupt or unsupported files by omission. */
async function loadManifests(rootDir) {
	const jobsDir = join(rootDir, "jobs");
	let entries;
	try {
		entries = await readdir(jobsDir, { withFileTypes: true });
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
	const manifests = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		try {
			const parsed = parseManifest(await readFile(join(jobsDir, entry.name, MANIFEST_NAME), "utf8"));
			if (parsed !== void 0) manifests.push(parsed);
		} catch {}
	}
	return manifests;
}
/** Sum regular-file bytes below one opaque job directory without following links. */
async function directorySize(path) {
	let total = 0;
	let entries;
	try {
		entries = await readdir(path, { withFileTypes: true });
	} catch (error) {
		if (error.code === "ENOENT") return 0;
		throw error;
	}
	for (const entry of entries) {
		const child = join(path, entry.name);
		if (entry.isDirectory()) total += await directorySize(child);
		else if (entry.isFile()) total += (await stat(child)).size;
	}
	return total;
}
//#endregion
//#region src/video/coordinator.ts
const DEFAULT_LIMITS = {
	maxUploadBytes: 200 * 1024 * 1024,
	hardMaxUploadBytes: 2 * 1024 * 1024 * 1024
};
const RETENTION_MS = 10080 * 60 * 1e3;
const DEFAULT_STORAGE_QUOTA = 2 * 1024 * 1024 * 1024;
const HARD_STORAGE_QUOTA = 100 * 1024 * 1024 * 1024;
const RESTORABLE_STATUSES = new Set([
	"ready",
	"done",
	"partial",
	"failed",
	"cancelled",
	"paused_config"
]);
function displayFileName(value) {
	const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
	return cleaned.length === 0 ? "video" : cleaned.slice(0, 255);
}
function randomVideoId() {
	return `video-${randomBytes(16).toString("hex")}`;
}
function limitsOf(options) {
	const hardMaxUploadBytes = options.limits?.hardMaxUploadBytes ?? DEFAULT_LIMITS.hardMaxUploadBytes;
	const requested = options.limits?.maxUploadBytes ?? DEFAULT_LIMITS.maxUploadBytes;
	return {
		hardMaxUploadBytes,
		maxUploadBytes: Math.min(requested, hardMaxUploadBytes)
	};
}
function publicSnapshot(snapshot) {
	return structuredClone(snapshot);
}
var DefaultVideoCoordinator = class DefaultVideoCoordinator {
	manifests = /* @__PURE__ */ new Map();
	limits;
	now;
	createId;
	options;
	storageQuotaBytes;
	processingActive = 0;
	processingWaiters = [];
	constructor(options) {
		this.options = options;
		this.limits = limitsOf(options);
		this.now = options.now ?? Date.now;
		this.createId = options.createId ?? randomVideoId;
		this.storageQuotaBytes = Math.min(HARD_STORAGE_QUOTA, Math.max(1, options.storageQuotaBytes ?? DEFAULT_STORAGE_QUOTA));
	}
	static async create(options) {
		const coordinator = new DefaultVideoCoordinator(options);
		await ensurePrivateDirectory(options.rootDir);
		await ensurePrivateDirectory(join(options.rootDir, "jobs"));
		for (const manifest of await loadManifests(options.rootDir)) {
			const jobDir = jobDirectory(options.rootDir, manifest.snapshot.videoId);
			if (RESTORABLE_STATUSES.has(manifest.snapshot.status) && coordinator.now() - manifest.snapshot.updatedAt >= RETENTION_MS) {
				await rm(jobDir, {
					recursive: true,
					force: true
				});
				continue;
			}
			if (!RESTORABLE_STATUSES.has(manifest.snapshot.status)) {
				manifest.snapshot = {
					...manifest.snapshot,
					status: "failed",
					updatedAt: coordinator.now(),
					error: {
						code: "interrupted_by_restart",
						message: "Video processing was interrupted by a host restart. Upload the video again."
					}
				};
				await writeManifest(jobDir, manifest);
			}
			coordinator.manifests.set(manifest.snapshot.videoId, manifest);
		}
		return coordinator;
	}
	async upload(input) {
		const staged = await this.createUpload(input);
		return this.writeUpload({
			videoId: staged.videoId,
			sessionId: input.sessionId,
			body: input.body,
			...input.signal === void 0 ? {} : { signal: input.signal }
		});
	}
	async createUpload(input) {
		this.validateUpload(input);
		await this.enforceStorageQuota(input.declaredSize);
		const videoId = this.createId();
		if (this.manifests.has(videoId)) throw new Error(`duplicate video id: ${videoId}`);
		const jobDir = jobDirectory(this.options.rootDir, videoId);
		await ensurePrivateDirectory(jobDir);
		const createdAt = this.now();
		const uploading = {
			videoId,
			sessionId: input.sessionId,
			fileName: displayFileName(input.fileName),
			mediaType: input.mediaType,
			sizeBytes: 0,
			sha256: "",
			status: "uploading",
			createdAt,
			updatedAt: createdAt,
			warnings: []
		};
		const manifest = {
			version: 1,
			snapshot: uploading,
			declaredSize: input.declaredSize
		};
		this.manifests.set(videoId, manifest);
		await writeManifest(jobDir, manifest);
		return publicSnapshot(uploading);
	}
	async writeUpload(input) {
		const manifest = this.owned(input.sessionId, input.videoId);
		if (manifest.snapshot.status !== "uploading" || manifest.declaredSize === void 0) {
			const error = /* @__PURE__ */ new Error("video is not waiting for upload bytes");
			error.code = "invalid_video_state";
			throw error;
		}
		input.signal?.throwIfAborted();
		const videoId = manifest.snapshot.videoId;
		const jobDir = jobDirectory(this.options.rootDir, videoId);
		const sourceFile = join(jobDir, "source.upload");
		let release;
		try {
			const { sizeBytes, sha256 } = await this.writeUploadFile(sourceFile, input, manifest.declaredSize);
			const duplicate = [...this.manifests.values()].find((candidate) => candidate !== manifest && candidate.snapshot.sessionId === manifest.snapshot.sessionId && candidate.snapshot.sha256 === sha256 && candidate.prepared !== void 0 && [
				"ready",
				"done",
				"partial"
			].includes(candidate.snapshot.status));
			if (duplicate !== void 0) {
				this.manifests.delete(videoId);
				await rm(jobDir, {
					recursive: true,
					force: true
				});
				return publicSnapshot(duplicate.snapshot);
			}
			await this.transition(manifest, jobDir, "queued", {
				sizeBytes,
				sha256
			});
			release = await this.acquireProcessing(input.signal);
			const prepared = await this.options.mediaEngine.prepare({
				videoId,
				sourceFile,
				originalFileName: manifest.snapshot.fileName,
				outputDir: jobDir,
				...input.signal === void 0 ? {} : { signal: input.signal },
				onStatus: (status) => this.transition(manifest, jobDir, status)
			});
			this.validatePrepared(prepared);
			manifest.prepared = structuredClone(prepared);
			await rm(sourceFile, { force: true });
			await this.transition(manifest, jobDir, "ready", {
				durationSeconds: prepared.durationSeconds,
				width: prepared.width,
				height: prepared.height,
				normalizedUrl: `/vision-bridge/videos/${videoId}/content`,
				posterUrl: `/vision-bridge/videos/${videoId}/poster`,
				frameCount: prepared.frames.length,
				warnings: [...prepared.warnings],
				sceneEngine: prepared.sceneEngine
			});
			await this.enforceStorageQuota(0, videoId);
			return publicSnapshot(manifest.snapshot);
		} catch (error) {
			await this.transition(manifest, jobDir, "failed", { error: {
				code: error?.code === void 0 ? "video_processing_failed" : String(error.code),
				message: error instanceof Error ? error.message : String(error)
			} }).catch(() => {});
			throw error;
		} finally {
			release?.();
		}
	}
	async list(sessionId) {
		return [...this.manifests.values()].map((manifest) => manifest.snapshot).filter((snapshot) => snapshot.sessionId === sessionId).sort((left, right) => right.updatedAt - left.updatedAt).map(publicSnapshot);
	}
	async delete(sessionId, videoId) {
		const manifest = this.owned(sessionId, videoId);
		if (!RESTORABLE_STATUSES.has(manifest.snapshot.status)) {
			const error = /* @__PURE__ */ new Error("active video work cannot be deleted");
			error.code = "invalid_video_state";
			throw error;
		}
		this.manifests.delete(videoId);
		await rm(jobDirectory(this.options.rootDir, videoId), {
			recursive: true,
			force: true
		});
	}
	health() {
		return this.options.mediaEngine.health();
	}
	async content(videoId, kind) {
		const manifest = this.manifests.get(videoId);
		const fileName = kind === "video" ? manifest?.prepared?.normalizedFile : manifest?.prepared?.posterFile;
		if (manifest === void 0 || fileName === void 0 || ![
			"ready",
			"done",
			"partial"
		].includes(manifest.snapshot.status)) {
			const error = /* @__PURE__ */ new Error("video content was not found");
			error.code = "video_not_found";
			throw error;
		}
		const path = join(jobDirectory(this.options.rootDir, videoId), fileName);
		const info = await stat(path);
		return {
			mediaType: kind === "video" ? "video/mp4" : "image/jpeg",
			sizeBytes: info.size,
			etag: `"sha256-${manifest.snapshot.sha256}"`,
			open: (range) => createReadStream(path, range === void 0 ? {} : {
				start: range.start,
				end: range.end
			})
		};
	}
	async analyze(input) {
		const manifest = this.owned(input.sessionId, input.videoId);
		const prepared = manifest.prepared;
		const interpreter = this.options.frameInterpreter;
		if (prepared === void 0 || ![
			"ready",
			"done",
			"partial"
		].includes(manifest.snapshot.status)) {
			const error = /* @__PURE__ */ new Error("video is not ready for analysis");
			error.code = "invalid_video_state";
			throw error;
		}
		if (interpreter === void 0) {
			const error = /* @__PURE__ */ new Error("video frame interpreter is not configured");
			error.code = "video_dependencies_unavailable";
			throw error;
		}
		input.signal?.throwIfAborted();
		const jobDir = jobDirectory(this.options.rootDir, input.videoId);
		const prompt = input.prompt?.trim() || "Describe what happens in this video, preserving temporal order and visible text.";
		await this.transition(manifest, jobDir, "analyzing", { error: void 0 });
		const batches = [];
		for (let index = 0; index < prepared.frames.length; index += 6) batches.push(prepared.frames.slice(index, index + 6));
		const evidence = new Array(batches.length);
		const failures = [];
		let cursor = 0;
		const worker = async () => {
			while (cursor < batches.length) {
				const index = cursor;
				cursor += 1;
				const batch = batches[index] ?? [];
				try {
					const frames = await Promise.all(batch.map(async (frame) => ({
						frameId: frame.frameId,
						timestampSeconds: frame.timestampSeconds,
						mediaType: "image/jpeg",
						data: await readFile(join(jobDir, frame.highResolutionFile ?? frame.file))
					})));
					input.signal?.throwIfAborted();
					const description = await interpreter.describe({
						frames,
						prompt,
						...input.signal === void 0 ? {} : { signal: input.signal }
					});
					evidence[index] = {
						frameIds: batch.map((frame) => frame.frameId),
						timestampsSeconds: batch.map((frame) => frame.timestampSeconds),
						description
					};
					await Promise.all(batch.map((frame) => frame.highResolutionFile === void 0 ? Promise.resolve() : rm(join(jobDir, frame.highResolutionFile), { force: true })));
				} catch (error) {
					failures.push(error instanceof Error ? error.message : String(error));
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(2, batches.length) }, worker));
		const completed = evidence.filter((value) => value !== void 0);
		if (completed.length === 0) {
			const error = new Error(failures[0] ?? "video frame analysis returned no evidence");
			error.code = "video_analysis_failed";
			await this.transition(manifest, jobDir, "failed", { error: {
				code: error.code,
				message: error.message
			} });
			throw error;
		}
		const result = {
			videoId: manifest.snapshot.videoId,
			fileName: manifest.snapshot.fileName,
			durationSeconds: prepared.durationSeconds,
			prompt,
			evidence: completed,
			warnings: [...prepared.warnings, ...failures.map((message) => `frame_batch_failed:${message}`)]
		};
		await this.transition(manifest, jobDir, failures.length === 0 ? "done" : "partial", {
			analysis: result,
			warnings: result.warnings
		});
		return structuredClone(result);
	}
	validateUpload(input) {
		if (input.sessionId.trim().length === 0) throw new Error("session id is required");
		if (!Number.isSafeInteger(input.declaredSize) || input.declaredSize < 1) throw new Error("declared video size must be a positive integer");
		if (input.declaredSize > this.limits.maxUploadBytes) {
			const error = /* @__PURE__ */ new Error(`video exceeds upload limit of ${this.limits.maxUploadBytes} bytes`);
			error.code = "upload_too_large";
			throw error;
		}
	}
	async enforceStorageQuota(requiredBytes, protectedVideoId) {
		const usages = await Promise.all([...this.manifests.values()].map(async (manifest) => ({
			manifest,
			bytes: await directorySize(jobDirectory(this.options.rootDir, manifest.snapshot.videoId))
		})));
		let total = usages.reduce((sum, item) => sum + item.bytes, 0);
		const evictable = usages.filter((item) => item.manifest.snapshot.videoId !== protectedVideoId && RESTORABLE_STATUSES.has(item.manifest.snapshot.status)).sort((left, right) => left.manifest.snapshot.updatedAt - right.manifest.snapshot.updatedAt);
		for (const item of evictable) {
			if (total + requiredBytes <= this.storageQuotaBytes) break;
			const videoId = item.manifest.snapshot.videoId;
			this.manifests.delete(videoId);
			await rm(jobDirectory(this.options.rootDir, videoId), {
				recursive: true,
				force: true
			});
			total -= item.bytes;
		}
		if (total + requiredBytes > this.storageQuotaBytes) {
			const error = /* @__PURE__ */ new Error("Video storage quota is exhausted by active work.");
			error.code = "storage_quota_exceeded";
			throw error;
		}
	}
	acquireProcessing(signal) {
		signal?.throwIfAborted();
		if (this.processingActive < 2) {
			this.processingActive += 1;
			return Promise.resolve(this.processingRelease());
		}
		return new Promise((resolve, reject) => {
			const waiter = {
				resolve,
				reject,
				...signal === void 0 ? {} : { signal }
			};
			const onAbort = () => {
				const index = this.processingWaiters.indexOf(waiter);
				if (index >= 0) this.processingWaiters.splice(index, 1);
				reject(signal?.reason ?? new DOMException("The operation was aborted", "AbortError"));
			};
			waiter.onAbort = onAbort;
			signal?.addEventListener("abort", onAbort, { once: true });
			this.processingWaiters.push(waiter);
		});
	}
	processingRelease() {
		let released = false;
		return () => {
			if (released) return;
			released = true;
			const waiter = this.processingWaiters.shift();
			if (waiter === void 0) {
				this.processingActive -= 1;
				return;
			}
			waiter.signal?.removeEventListener("abort", waiter.onAbort);
			waiter.resolve(this.processingRelease());
		};
	}
	async writeUploadFile(path, input, declaredSize) {
		const handle = await open(path, "wx", 384);
		const hash = createHash("sha256");
		let sizeBytes = 0;
		try {
			for await (const chunk of input.body) {
				input.signal?.throwIfAborted();
				sizeBytes += chunk.byteLength;
				if (sizeBytes > this.limits.maxUploadBytes || sizeBytes > declaredSize) {
					const error = /* @__PURE__ */ new Error("video upload exceeded its declared or configured size");
					error.code = "upload_too_large";
					throw error;
				}
				hash.update(chunk);
				await handle.write(chunk);
			}
			if (sizeBytes !== declaredSize) {
				const error = /* @__PURE__ */ new Error(`video upload size mismatch: expected ${declaredSize}, received ${sizeBytes}`);
				error.code = "upload_size_mismatch";
				throw error;
			}
			await handle.sync();
		} finally {
			await handle.close();
			await chmod(path, 384).catch(() => {});
		}
		return {
			sizeBytes,
			sha256: hash.digest("hex")
		};
	}
	owned(sessionId, videoId) {
		const manifest = this.manifests.get(videoId);
		if (manifest === void 0 || manifest.snapshot.sessionId !== sessionId) {
			const error = /* @__PURE__ */ new Error("video was not found");
			error.code = "video_not_found";
			throw error;
		}
		return manifest;
	}
	validatePrepared(prepared) {
		if (!Number.isFinite(prepared.durationSeconds) || prepared.durationSeconds <= 0) throw new Error("media engine returned an invalid duration");
		if (!Number.isSafeInteger(prepared.width) || prepared.width < 1 || !Number.isSafeInteger(prepared.height) || prepared.height < 1) throw new Error("media engine returned invalid dimensions");
		for (const file of [
			prepared.normalizedFile,
			prepared.posterFile,
			...prepared.frames.flatMap((frame) => [frame.file, frame.highResolutionFile].filter((value) => value !== void 0))
		]) if (file !== void 0 && file !== file.split(/[\\/]/).at(-1)) throw new Error("media engine returned a nested artifact path");
	}
	async transition(manifest, jobDir, status, patch = {}) {
		manifest.snapshot = {
			...manifest.snapshot,
			...patch,
			status,
			updatedAt: this.now()
		};
		await writeManifest(jobDir, manifest);
	}
};
/** Install the deep coordinator module over storage and media adapters. */
function createVideoCoordinator(options) {
	return DefaultVideoCoordinator.create(options);
}
//#endregion
//#region src/video/probe.ts
function videoError(code, message) {
	const error = new Error(message);
	error.code = code;
	return error;
}
function extensionFamily(fileName) {
	switch (extname(fileName).toLowerCase()) {
		case ".mp4":
		case ".m4v":
		case ".mov": return "iso-bmff";
		case ".avi": return "avi";
		case ".mpg":
		case ".mpeg": return "mpeg-ps";
		case ".mkv": return "matroska";
		case ".webm": return "webm";
		default: return;
	}
}
async function signatureFamily(path) {
	const handle = await open(path, "r");
	try {
		const buffer = Buffer.alloc(4096);
		const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0);
		const bytes = buffer.subarray(0, bytesRead);
		if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "AVI ") return "avi";
		if (bytes.length >= 4 && bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163) {
			const lower = bytes.toString("latin1").toLowerCase();
			if (lower.includes("webm")) return "webm";
			if (lower.includes("matroska")) return "matroska";
		}
		for (let offset = 4; offset + 4 <= bytes.length && offset <= 1024; offset += 4) if (bytes.toString("ascii", offset, offset + 4) === "ftyp") return "iso-bmff";
		if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && (bytes[3] === 186 || bytes[3] === 187 || bytes[3] === 179)) return "mpeg-ps";
		return;
	} finally {
		await handle.close();
	}
}
function probedFamily(formatName, signature) {
	const names = new Set(formatName.split(","));
	if (names.has("mov") || names.has("mp4")) return "iso-bmff";
	if (names.has("avi")) return "avi";
	if (names.has("mpeg")) return "mpeg-ps";
	if (names.has("matroska") || names.has("webm")) return signature === "webm" ? "webm" : signature === "matroska" ? "matroska" : void 0;
}
function rateOf(value) {
	if (value === void 0) return 0;
	const [numerator, denominator = "1"] = value.split("/");
	const rate = Number(numerator) / Number(denominator);
	return Number.isFinite(rate) ? rate : 0;
}
function selectVideoStream(streams) {
	const videos = streams.filter((stream) => stream.codec_type === "video" && stream.disposition?.attached_pic !== 1);
	if (videos.length === 1) return videos[0];
	const defaults = videos.filter((stream) => stream.disposition?.default === 1);
	if (defaults.length === 1) return defaults[0];
	if (videos.length === 0) throw videoError("video_stream_missing", "The container has no decodable video stream.");
	throw videoError("multiple_video_streams", "The container has multiple video streams and no unique default stream.");
}
/** Inspect an untrusted local upload and cross-check its declared container family. */
async function inspectVideo(options) {
	const extension = extensionFamily(options.originalFileName);
	if (extension === void 0) throw videoError("unsupported_container", "The video filename has an unsupported extension.");
	const signature = await signatureFamily(options.path);
	if (signature === void 0) throw videoError("unsupported_container", "The file signature is not a supported video container.");
	const result = await options.run(options.ffprobe, [
		"-v",
		"error",
		"-show_format",
		"-show_streams",
		"-of",
		"json",
		options.path
	], {
		timeoutMs: 15e3,
		...options.signal === void 0 ? {} : { signal: options.signal }
	});
	if (result.exitCode !== 0) throw videoError("invalid_video", result.stderr.trim() || "FFprobe could not inspect the video.");
	let raw;
	try {
		raw = JSON.parse(result.stdout);
	} catch {
		throw videoError("invalid_video", "FFprobe returned invalid metadata.");
	}
	const probed = probedFamily(raw.format?.format_name ?? "", signature);
	if (probed === void 0) throw videoError("unsupported_container", "FFprobe identified an unsupported video container.");
	if (extension !== signature || extension !== probed) throw videoError("container_mismatch", "The filename, file signature, and detected container do not agree.");
	const durationSeconds = Number(raw.format?.duration);
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw videoError("invalid_duration", "The video duration must be greater than zero.");
	if (durationSeconds > (options.maxDurationSeconds ?? 600)) throw videoError("duration_limit", "The video exceeds the configured duration limit.");
	const selected = selectVideoStream(raw.streams ?? []);
	const width = Number(selected.width);
	const height = Number(selected.height);
	if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) throw videoError("invalid_dimensions", "The selected video stream has invalid dimensions.");
	const maxDimension = options.maxDimension ?? 4096;
	if (width > maxDimension || height > maxDimension) throw videoError("resolution_limit", "The video exceeds the configured resolution limit.");
	const tags = {
		...raw.format?.tags,
		...selected.tags
	};
	if (Object.keys(tags).some((key) => /encrypt|drm/i.test(key))) throw videoError("protected_video", "Encrypted or DRM-protected video is not supported.");
	const pixelFormat = selected.pix_fmt ?? "";
	const transfer = selected.color_transfer?.toLowerCase() ?? "";
	return {
		family: probed,
		durationSeconds,
		stream: {
			index: selected.index ?? 0,
			codecName: selected.codec_name ?? "",
			pixelFormat,
			width,
			height,
			frameRate: rateOf(selected.avg_frame_rate ?? selected.r_frame_rate),
			hdr: transfer === "smpte2084" || transfer === "arib-std-b67",
			interlaced: selected.field_order !== void 0 && selected.field_order !== "progressive" && selected.field_order !== "unknown",
			alpha: /(^|a)(yuva|rgba|argb|bgra|gbrap|ya)/i.test(pixelFormat)
		},
		hasAudio: (raw.streams ?? []).some((stream) => stream.codec_type === "audio")
	};
}
//#endregion
//#region src/video/process-runner.ts
const DEFAULT_OUTPUT_LIMIT = 64 * 1024;
function appendBounded(current, chunk, limit) {
	if (current.byteLength >= limit) return current;
	return Buffer.concat([current, chunk.subarray(0, limit - current.byteLength)]);
}
/** Run one local media command without a shell and with bounded diagnostics. */
const runCommand = (executable, args, options = {}) => new Promise((resolve, reject) => {
	options.signal?.throwIfAborted();
	const child = spawn(executable, [...args], {
		shell: false,
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		],
		windowsHide: true,
		detached: process.platform !== "win32",
		...options.cwd === void 0 ? {} : { cwd: options.cwd }
	});
	const limit = options.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT;
	let stdout = Buffer.alloc(0);
	let stderr = Buffer.alloc(0);
	let settled = false;
	let forceTimer;
	const killTree = (signal) => {
		if (process.platform !== "win32" && child.pid !== void 0) try {
			process.kill(-child.pid, signal);
			return;
		} catch {}
		child.kill(signal);
	};
	const terminate = () => {
		if (child.exitCode !== null || child.signalCode !== null) return;
		killTree("SIGTERM");
		forceTimer = setTimeout(() => killTree("SIGKILL"), 1e3);
		forceTimer.unref();
	};
	const onAbort = () => terminate();
	options.signal?.addEventListener("abort", onAbort, { once: true });
	const timeout = options.timeoutMs === void 0 ? void 0 : setTimeout(terminate, options.timeoutMs);
	timeout?.unref();
	child.stdout.on("data", (chunk) => {
		stdout = appendBounded(stdout, chunk, limit);
	});
	child.stderr.on("data", (chunk) => {
		stderr = appendBounded(stderr, chunk, limit);
	});
	child.once("error", (error) => {
		if (settled) return;
		settled = true;
		if (timeout !== void 0) clearTimeout(timeout);
		if (forceTimer !== void 0) clearTimeout(forceTimer);
		options.signal?.removeEventListener("abort", onAbort);
		if (error.code === "ENOENT") resolve({
			stdout: "",
			stderr: error.message,
			exitCode: 127
		});
		else reject(error);
	});
	child.once("close", (code) => {
		if (settled) return;
		settled = true;
		if (timeout !== void 0) clearTimeout(timeout);
		if (forceTimer !== void 0) clearTimeout(forceTimer);
		options.signal?.removeEventListener("abort", onAbort);
		if (options.signal?.aborted === true) {
			reject(options.signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
			return;
		}
		resolve({
			stdout: stdout.toString("utf8"),
			stderr: stderr.toString("utf8"),
			exitCode: code ?? 1
		});
	});
});
//#endregion
//#region src/video/scenes.ts
function parseCsvLine(line) {
	const values = [];
	let value = "";
	let quoted = false;
	for (const character of line) if (character === "\"") quoted = !quoted;
	else if (character === "," && !quoted) {
		values.push(value);
		value = "";
	} else value += character;
	values.push(value);
	return values;
}
async function loadSceneCsv(path) {
	const lines = (await readFile(path, "utf8")).trim().split(/\r?\n/);
	const header = parseCsvLine(lines[0] ?? "");
	const startIndex = header.indexOf("Start Time (seconds)");
	const endIndex = header.indexOf("End Time (seconds)");
	if (startIndex < 0 || endIndex < 0) throw new Error("PySceneDetect CSV is missing time columns");
	return lines.slice(1).flatMap((line) => {
		const fields = parseCsvLine(line);
		const start = Number(fields[startIndex]);
		const end = Number(fields[endIndex]);
		return Number.isFinite(start) && Number.isFinite(end) && end > start ? [{
			start,
			end
		}] : [];
	});
}
function mergeRanges(ranges, duration) {
	const cuts = [...new Set(ranges.flatMap((range) => [
		range.start,
		range.end,
		0,
		duration
	]).map((value) => Math.max(0, Math.min(duration, value)).toFixed(3)))].map(Number).sort((left, right) => left - right);
	const mergedCuts = [];
	for (const cut of cuts) if (mergedCuts.length === 0 || cut - (mergedCuts.at(-1) ?? 0) >= .25) mergedCuts.push(cut);
	if ((mergedCuts.at(-1) ?? 0) < duration) mergedCuts.push(duration);
	return mergedCuts.slice(0, -1).map((start, index) => ({
		start,
		end: mergedCuts[index + 1] ?? duration
	}));
}
function selectTimestamps(ranges, duration, limit) {
	const finalTimestamp = Math.max(0, duration - 1 / 15);
	const values = new Set([0, finalTimestamp]);
	for (const range of ranges) {
		values.add((range.start + range.end) / 2);
		if (range.end - range.start > 20) for (let value = range.start + 10; value < range.end; value += 10) values.add(value);
	}
	const candidates = [...values].map((value) => Math.max(0, Math.min(finalTimestamp, value))).sort((a, b) => a - b);
	const deduped = candidates.filter((value, index) => index === 0 || value - candidates[index - 1] >= .05);
	if (deduped.length <= limit) return deduped;
	const selected = [deduped[0]];
	for (let index = 1; index < limit - 1; index += 1) selected.push(deduped[Math.round(index * (deduped.length - 1) / (limit - 1))]);
	selected.push(deduped.at(-1) ?? finalTimestamp);
	return [...new Set(selected)];
}
/** Run both required detectors and derive the bounded initial frame timestamps. */
async function sceneTimestamps(options) {
	const detectors = [{
		command: "detect-adaptive",
		file: "adaptive-scenes.csv"
	}, {
		command: "detect-threshold",
		file: "threshold-scenes.csv"
	}];
	const ranges = [];
	for (const detector of detectors) {
		const result = await options.run(options.executable, [
			"-i",
			options.input,
			detector.command,
			"list-scenes",
			"--output",
			options.outputDir,
			"--filename",
			detector.file,
			"--skip-cuts",
			"--quiet"
		], {
			timeoutMs: Math.min(15 * 6e4, Math.max(6e4, options.durationSeconds * 2e3)),
			...options.signal === void 0 ? {} : { signal: options.signal }
		});
		if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `PySceneDetect ${detector.command} failed`);
		ranges.push(...await loadSceneCsv(join(options.outputDir, detector.file)));
	}
	return selectTimestamps(mergeRanges(ranges, options.durationSeconds), options.durationSeconds, options.limit);
}
//#endregion
//#region src/video/media-engine.ts
const MIN_FFMPEG = [6, 1];
const MIN_SCENEDETECT = [
	0,
	7,
	1
];
const MAX_SCENEDETECT = [
	0,
	8,
	0
];
function versionOf(text) {
	return text.match(/\b(?:version\s+|PySceneDetect\s+)(?:n)?(\d+\.\d+(?:\.\d+)?)/i)?.[1];
}
function versionParts(version) {
	const values = version.split(".").map(Number);
	return [
		values[0] ?? 0,
		values[1] ?? 0,
		values[2] ?? 0
	];
}
function compareVersion(left, right) {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}
function containsWord(output, value) {
	return new RegExp(`(?:^|\\s)${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "m").test(output);
}
function seekTimestamp(seconds) {
	return (Math.floor(Math.max(0, seconds) * 1e3) / 1e3).toFixed(3);
}
var SystemMediaEngine = class {
	run;
	ffmpeg;
	ffprobe;
	sceneDetect;
	constructor(options) {
		this.run = options.run ?? runCommand;
		this.ffmpeg = options.ffmpegPath ?? "ffmpeg";
		this.ffprobe = options.ffprobePath ?? "ffprobe";
		this.sceneDetect = options.sceneDetectPath ?? "scenedetect";
	}
	async health() {
		const [ffmpegVersionCall, ffprobeVersionCall, sceneVersionCall, encodersCall, filtersCall] = await Promise.all([
			this.run(this.ffmpeg, ["-version"], { timeoutMs: 15e3 }),
			this.run(this.ffprobe, ["-version"], { timeoutMs: 15e3 }),
			this.run(this.sceneDetect, ["version"], { timeoutMs: 15e3 }),
			this.run(this.ffmpeg, ["-hide_banner", "-encoders"], { timeoutMs: 15e3 }),
			this.run(this.ffmpeg, ["-hide_banner", "-filters"], { timeoutMs: 15e3 })
		]);
		const ffmpegVersion = ffmpegVersionCall.exitCode === 0 ? versionOf(ffmpegVersionCall.stdout) : void 0;
		const ffprobeVersion = ffprobeVersionCall.exitCode === 0 ? versionOf(ffprobeVersionCall.stdout) : void 0;
		const sceneVersion = sceneVersionCall.exitCode === 0 ? versionOf(sceneVersionCall.stdout) : void 0;
		const encoders = `${encodersCall.stdout}\n${encodersCall.stderr}`;
		const filters = `${filtersCall.stdout}\n${filtersCall.stderr}`;
		const features = {
			libx264: containsWord(encoders, "libx264"),
			nvenc: containsWord(encoders, "h264_nvenc"),
			hdrToneMap: containsWord(filters, "zscale") && containsWord(filters, "tonemap"),
			deinterlace: containsWord(filters, "bwdif")
		};
		const issues = [];
		if (ffmpegVersion === void 0) issues.push({
			code: "ffmpeg_unavailable",
			message: "FFmpeg was not found or did not report a version."
		});
		else if (compareVersion(versionParts(ffmpegVersion), MIN_FFMPEG) < 0) issues.push({
			code: "ffmpeg_too_old",
			message: `FFmpeg ${ffmpegVersion} is older than 6.1.`
		});
		if (ffprobeVersion === void 0) issues.push({
			code: "ffprobe_unavailable",
			message: "FFprobe was not found or did not report a version."
		});
		else if (compareVersion(versionParts(ffprobeVersion), MIN_FFMPEG) < 0) issues.push({
			code: "ffprobe_too_old",
			message: `FFprobe ${ffprobeVersion} is older than 6.1.`
		});
		if (ffmpegVersion !== void 0 && ffprobeVersion !== void 0 && versionParts(ffmpegVersion)[0] !== versionParts(ffprobeVersion)[0]) issues.push({
			code: "ffmpeg_ffprobe_mismatch",
			message: "FFmpeg and FFprobe must use the same major version."
		});
		if (!features.libx264) issues.push({
			code: "libx264_unavailable",
			message: "FFmpeg does not expose the libx264 encoder."
		});
		if (sceneVersion === void 0) issues.push({
			code: "scenedetect_unavailable",
			message: "PySceneDetect was not found on PATH."
		});
		else if (compareVersion(versionParts(sceneVersion), MIN_SCENEDETECT) < 0 || compareVersion(versionParts(sceneVersion), MAX_SCENEDETECT) >= 0) issues.push({
			code: "scenedetect_unsupported_version",
			message: `PySceneDetect ${sceneVersion} is outside the supported >=0.7.1 <0.8 range.`
		});
		else {
			const [adaptive, threshold] = await Promise.all([this.run(this.sceneDetect, ["help", "detect-adaptive"], { timeoutMs: 15e3 }), this.run(this.sceneDetect, ["help", "detect-threshold"], { timeoutMs: 15e3 })]);
			if (adaptive.exitCode !== 0 || threshold.exitCode !== 0) issues.push({
				code: "scenedetect_commands_unavailable",
				message: "Required scene detectors are unavailable."
			});
		}
		return {
			available: issues.length === 0,
			...ffmpegVersion === void 0 ? {} : { ffmpeg: { version: ffmpegVersion } },
			...ffprobeVersion === void 0 ? {} : { ffprobe: { version: ffprobeVersion } },
			...sceneVersion === void 0 ? {} : { sceneDetect: { version: sceneVersion } },
			features,
			issues
		};
	}
	async prepare(request) {
		const health = await this.health();
		if (!health.available) {
			const error = new Error(health.issues.map((issue) => issue.message).join(" "));
			error.code = "video_dependencies_unavailable";
			throw error;
		}
		await mkdir(request.outputDir, { recursive: true });
		await request.onStatus("validating");
		const input = await inspectVideo({
			path: request.sourceFile,
			originalFileName: request.originalFileName,
			ffprobe: this.ffprobe,
			run: this.run,
			...request.signal === void 0 ? {} : { signal: request.signal }
		});
		if (input.stream.hdr && !health.features.hdrToneMap) {
			const error = /* @__PURE__ */ new Error("HDR input requires FFmpeg zscale and tonemap filters.");
			error.code = "hdr_filters_unavailable";
			throw error;
		}
		await request.onStatus("transcoding");
		const partial = join(request.outputDir, "normalized.part.mp4");
		const normalized = join(request.outputDir, "normalized.mp4");
		const filters = this.filtersFor(input);
		await this.checked(this.ffmpeg, [
			"-hide_banner",
			"-nostdin",
			"-y",
			"-i",
			request.sourceFile,
			"-map",
			`0:${input.stream.index}`,
			"-an",
			"-sn",
			"-dn",
			"-map_metadata",
			"-1",
			"-vf",
			filters.join(","),
			"-c:v",
			"libx264",
			"-preset",
			"medium",
			"-crf",
			"26",
			"-pix_fmt",
			"yuv420p",
			"-movflags",
			"+faststart",
			partial
		], request.signal, Math.min(30 * 6e4, Math.max(12e4, input.durationSeconds * 4e3)));
		const output = await inspectVideo({
			path: partial,
			originalFileName: "normalized.mp4",
			ffprobe: this.ffprobe,
			run: this.run,
			maxDurationSeconds: 7200,
			maxDimension: 1280,
			...request.signal === void 0 ? {} : { signal: request.signal }
		});
		this.verifyOutput(input, output);
		await rename(partial, normalized);
		await request.onStatus("detecting");
		const timestamps = await sceneTimestamps({
			executable: this.sceneDetect,
			input: normalized,
			outputDir: request.outputDir,
			durationSeconds: output.durationSeconds,
			limit: 48,
			run: this.run,
			...request.signal === void 0 ? {} : { signal: request.signal }
		});
		await request.onStatus("extracting");
		const frames = [];
		for (const [index, timestampSeconds] of timestamps.entries()) {
			const frameId = `F${String(index + 1).padStart(2, "0")}`;
			const file = `frame-${frameId}.jpg`;
			const highResolutionFile = `frame-${frameId}-hq.jpg`;
			await this.extractFrame(normalized, join(request.outputDir, file), timestampSeconds, 0, request.signal);
			await this.extractFrame(request.sourceFile, join(request.outputDir, highResolutionFile), timestampSeconds, input.stream.index, request.signal);
			frames.push({
				frameId,
				timestampSeconds,
				file,
				highResolutionFile
			});
		}
		if (frames.length === 0) throw new Error("video preparation produced no keyframes");
		await copyFile(join(request.outputDir, frames[0].file), join(request.outputDir, "poster.jpg"));
		return {
			normalizedFile: "normalized.mp4",
			posterFile: "poster.jpg",
			durationSeconds: output.durationSeconds,
			width: output.stream.width,
			height: output.stream.height,
			frames,
			warnings: [
				"audio_not_analyzed",
				...input.stream.alpha ? ["alpha_flattened"] : [],
				...input.stream.interlaced ? ["deinterlaced"] : [],
				...input.stream.hdr ? ["hdr_tone_mapped"] : []
			],
			sceneEngine: "pyscenedetect"
		};
	}
	async extractRange(_request) {
		throw new Error("system range extraction is not implemented");
	}
	filtersFor(input) {
		return [
			...input.stream.interlaced ? ["bwdif=mode=send_frame:parity=auto:deint=interlaced"] : [],
			...input.stream.alpha ? ["format=rgba", "geq=r='r(X,Y)*alpha(X,Y)/255+128*(1-alpha(X,Y)/255)':g='g(X,Y)*alpha(X,Y)/255+128*(1-alpha(X,Y)/255)':b='b(X,Y)*alpha(X,Y)/255+128*(1-alpha(X,Y)/255)':a=255"] : [],
			...input.stream.hdr ? [
				"zscale=t=linear:npl=100",
				"format=gbrpf32le",
				"zscale=p=bt709",
				"tonemap=hable:desat=0",
				"zscale=t=bt709:m=bt709:r=tv"
			] : [],
			"scale=w='if(gt(iw,ih),min(1280,iw),-2)':h='if(gt(iw,ih),-2,min(1280,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2",
			"setsar=1",
			"fps=15",
			"format=yuv420p"
		];
	}
	verifyOutput(input, output) {
		if (output.family !== "iso-bmff" || output.stream.codecName !== "h264" || output.stream.pixelFormat !== "yuv420p") throw new Error("normalized output is not MP4/H.264/yuv420p");
		if (output.stream.width > 1280 || output.stream.height > 1280 || output.stream.width % 2 !== 0 || output.stream.height % 2 !== 0 || output.stream.frameRate > 15.01) throw new Error("normalized output violates dimension or frame-rate limits");
		const tolerance = Math.max(1, input.durationSeconds * .01);
		if (Math.abs(input.durationSeconds - output.durationSeconds) > tolerance) throw new Error("normalized output duration differs from the input");
	}
	async extractFrame(input, output, timestampSeconds, streamIndex, signal) {
		await this.checked(this.ffmpeg, [
			"-hide_banner",
			"-nostdin",
			"-y",
			"-ss",
			seekTimestamp(timestampSeconds),
			"-i",
			input,
			"-map",
			`0:${streamIndex}`,
			"-frames:v",
			"1",
			"-q:v",
			"3",
			output
		], signal, 6e4);
	}
	async checked(executable, args, signal, timeoutMs) {
		const result = await this.run(executable, args, {
			timeoutMs,
			...signal === void 0 ? {} : { signal }
		});
		if (result.exitCode !== 0) {
			const error = new Error(result.stderr.trim() || `${executable} exited with code ${result.exitCode}`);
			error.code = "media_command_failed";
			throw error;
		}
	}
};
/** Create the production FFmpeg/PySceneDetect adapter with injectable command execution for tests. */
function createSystemMediaEngine(options = {}) {
	return new SystemMediaEngine(options);
}
//#endregion
//#region src/video/http.ts
function writeJson(res, value, status = 200) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(body),
		"X-Content-Type-Options": "nosniff"
	});
	res.end(body);
}
async function readJson(req, limit = 64 * 1024) {
	const chunks = [];
	let size = 0;
	for await (const value of req) {
		const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
		size += chunk.byteLength;
		if (size > limit) throw codedError("request_too_large", "Request metadata is too large.");
		chunks.push(chunk);
	}
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("object required");
		return parsed;
	} catch (error) {
		if (error.code === "request_too_large") throw error;
		throw codedError("invalid_json", "Request body must be a JSON object.");
	}
}
function codedError(code, message) {
	const error = new Error(message);
	error.code = code;
	return error;
}
function stringField(value, key) {
	if (typeof value[key] !== "string") throw codedError("invalid_request", `${key} must be a string`);
	return value[key];
}
function numberField(value, key) {
	if (typeof value[key] !== "number") throw codedError("invalid_request", `${key} must be a number`);
	return value[key];
}
function sameOrigin(req) {
	const origin = req.headers.origin;
	const host = req.headers.host;
	if (origin === void 0 || host === void 0) return false;
	try {
		const url = new URL(origin);
		return url.host === host && (url.protocol === "http:" || url.protocol === "https:");
	} catch {
		return false;
	}
}
function statusFor(error) {
	switch (error?.code) {
		case "video_not_found": return 404;
		case "upload_too_large":
		case "request_too_large": return 413;
		case "invalid_video_state": return 409;
		case "video_dependencies_unavailable": return 503;
		case "storage_quota_exceeded": return 507;
		default: return 400;
	}
}
function rangeOf(header, size) {
	if (header === void 0) return void 0;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (match === null || match[1] === "" && match[2] === "") return null;
	let start;
	let end;
	if (match[1] === "") {
		const suffix = Number(match[2]);
		if (!Number.isSafeInteger(suffix) || suffix < 1) return null;
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = Number(match[1]);
		end = match[2] === "" ? size - 1 : Number(match[2]);
	}
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
	return {
		start,
		end: Math.min(end, size - 1)
	};
}
async function sendContent(req, res, content) {
	const range = rangeOf(typeof req.headers.range === "string" ? req.headers.range : void 0, content.sizeBytes);
	if (range === null) {
		res.writeHead(416, {
			"Content-Range": `bytes */${content.sizeBytes}`,
			"Accept-Ranges": "bytes"
		});
		res.end();
		return;
	}
	const headers = {
		"Content-Type": content.mediaType,
		"Content-Disposition": "inline",
		"Accept-Ranges": "bytes",
		"ETag": content.etag,
		"X-Content-Type-Options": "nosniff",
		"Cache-Control": "private, no-cache"
	};
	if (range === void 0) {
		headers["Content-Length"] = content.sizeBytes;
		res.writeHead(200, headers);
	} else {
		headers["Content-Length"] = range.end - range.start + 1;
		headers["Content-Range"] = `bytes ${range.start}-${range.end}/${content.sizeBytes}`;
		res.writeHead(206, headers);
	}
	if (req.method === "HEAD") {
		res.end();
		return;
	}
	await pipeline(Readable.from(content.open(range ?? void 0)), res);
}
/** Register the complete same-origin HTTP adapter over the coordinator interface. */
function registerVideoRoutes(webServer, coordinator, options) {
	return webServer.register({
		kind: "prefix",
		path: "/vision-bridge/videos",
		async handler(req, res) {
			const url = new URL(req.url ?? "/vision-bridge/videos", `http://${req.headers.host ?? "localhost"}`);
			const segments = url.pathname.split("/").filter(Boolean);
			try {
				if (req.method === "GET" && url.pathname === "/vision-bridge/videos/health") {
					writeJson(res, await coordinator.health());
					return;
				}
				if (req.method === "GET" && url.pathname === "/vision-bridge/videos") {
					const sessionId = url.searchParams.get("sessionId") ?? "";
					if (!options.sessionExists(sessionId)) throw codedError("video_not_found", "Session was not found.");
					writeJson(res, { videos: await coordinator.list(sessionId) });
					return;
				}
				if (req.method === "POST" && url.pathname === "/vision-bridge/videos") {
					if (!sameOrigin(req)) throw codedError("origin_rejected", "A same-origin request is required.");
					const body = await readJson(req);
					const sessionId = stringField(body, "sessionId");
					if (!options.sessionExists(sessionId)) throw codedError("video_not_found", "Session was not found.");
					writeJson(res, { video: await coordinator.createUpload({
						sessionId,
						fileName: stringField(body, "fileName"),
						mediaType: stringField(body, "mediaType"),
						declaredSize: numberField(body, "declaredSize")
					}) }, 201);
					return;
				}
				const videoId = segments.length >= 3 ? decodeURIComponent(segments[2]) : "";
				const operation = segments[3];
				if (req.method === "PUT" && operation === "upload") {
					if (!sameOrigin(req)) throw codedError("origin_rejected", "A same-origin request is required.");
					const sessionId = url.searchParams.get("sessionId") ?? "";
					const controller = new AbortController();
					req.once("aborted", () => controller.abort());
					writeJson(res, { video: await coordinator.writeUpload({
						videoId,
						sessionId,
						body: req,
						signal: controller.signal
					}) });
					return;
				}
				if ((req.method === "GET" || req.method === "HEAD") && (operation === "content" || operation === "poster")) {
					await sendContent(req, res, await coordinator.content(videoId, operation === "content" ? "video" : "poster"));
					return;
				}
				if (req.method === "DELETE" && segments.length === 3) {
					if (!sameOrigin(req)) throw codedError("origin_rejected", "A same-origin request is required.");
					const sessionId = url.searchParams.get("sessionId") ?? "";
					await coordinator.delete(sessionId, videoId);
					res.writeHead(204);
					res.end();
					return;
				}
				writeJson(res, { error: {
					code: "not_found",
					message: "Video route was not found."
				} }, 404);
			} catch (error) {
				if (res.headersSent) {
					res.destroy(error instanceof Error ? error : void 0);
					return;
				}
				writeJson(res, { error: {
					code: String(error?.code ?? "video_request_failed"),
					message: error instanceof Error ? error.message : String(error)
				} }, statusFor(error));
			}
		}
	});
}
//#endregion
//#region src/video/frame-interpreter.ts
function base64(data) {
	return Buffer.from(data).toString("base64");
}
function timestampedPrompt(prompt, frames) {
	return `${prompt}\nThe images are chronological video frames: ${frames.map((frame) => `${frame.frameId} @ ${frame.timestampSeconds.toFixed(3)}s`).join(", ")}. Describe the observable evidence in temporal order. Attribute changes and visible text to frame ids/timestamps. Do not infer audio or events that are not visible.`;
}
function batchUnsupported(error) {
	const status = error?.statusCode;
	return status === 400 || status === 415 || status === 422;
}
/** Bind frame interpretation to the plugin's existing vision configuration. */
function createVisionFrameInterpreter(resolveFacts) {
	return { async describe(request) {
		const facts = await resolveFacts();
		if (facts === void 0) throw new Error("vision model is not configured");
		const prompt = timestampedPrompt(request.prompt, request.frames);
		try {
			return (await describeImages(facts.url, facts.apiKey, facts.model, request.frames.map((frame) => ({
				data: base64(frame.data),
				mediaType: frame.mediaType
			})), prompt, request.signal)).description;
		} catch (error) {
			if (request.frames.length < 2 || !batchUnsupported(error)) throw error;
			const descriptions = [];
			for (const frame of request.frames) {
				request.signal?.throwIfAborted();
				const result = await describeImage(facts.url, facts.apiKey, facts.model, base64(frame.data), frame.mediaType, timestampedPrompt(request.prompt, [frame]), request.signal);
				descriptions.push(`[${frame.frameId} @ ${frame.timestampSeconds.toFixed(3)}s] ${result.description}`);
			}
			return descriptions.join("\n");
		}
	} };
}
//#endregion
//#region src/index.ts
/** Vision-bridge plugin name. */
const name = "vision-bridge";
/**
* Required services: the core seams the bridge cannot function without —
* the tool registry, the settings/credentials seams for the vision endpoint
* facts, the attachment store for image bytes, the llm registry for the
* wrapper adapter, and systemPrompt for model guidance. All ship in the base
* bundle; webServer stays optional because it exists only in web-surface trees.
*/
const inject = [
	"tools",
	"settings",
	"credentials",
	"attachments",
	"llm",
	"systemPrompt",
	"agents",
	"sessions"
];
/**
* The host half: model-bound image description, the describe tool, the panel's
* HTTP routes, and the wrapper adapter.
* @param ctx - plugin context.
*/
function apply(ctx) {
	const refs = /* @__PURE__ */ new Map();
	const recent = [];
	const MAX_RECENT_IMAGES = 20;
	const activities = new VisionActivityStore();
	const settings = ctx.get("settings");
	const credentials = ctx.get("credentials");
	const attachments = ctx.get("attachments");
	const webServer = ctx.get("webServer");
	/** Locate the currently open turn for one adapter request. */
	function activeTurn(sessionId) {
		const events = ctx.agents.get(SessionId(sessionId))?.session.events;
		if (events === void 0) return void 0;
		const ended = /* @__PURE__ */ new Set();
		for (let index = events.length - 1; index >= 0; index -= 1) {
			const event = events[index];
			if (event?.type === "turn/end") ended.add(event.data.turn);
			if (event?.type === "turn/start" && !ended.has(event.data.turn)) return event.data.turn;
		}
	}
	/** Whether an activity's owning turn has reached its durable end boundary. */
	function withTurnState(entry) {
		if (entry.turn === void 0) return {
			...entry,
			turnClosed: entry.status !== "running"
		};
		const events = ctx.agents.get(SessionId(entry.sessionId))?.session.events;
		const turnClosed = events === void 0 ? entry.status !== "running" : events.some((event) => event.type === "turn/end" && event.data.turn === entry.turn);
		return {
			...entry,
			turnClosed
		};
	}
	const scope = settings.register(NS, VisionBridgeConfig, { base: {
		url: "",
		model: "",
		apiKeyEnv: DEFAULT_API_KEY_ENV
	} });
	/** The configured per-image description-history limit (default, or `null` = unlimited). */
	function historyLimit() {
		const limit = scope.get().historyLimit;
		return limit === void 0 ? 20 : limit;
	}
	/** Resolve the configured endpoint facts, or undefined when unconfigured. */
	async function resolvedFacts() {
		const value = scope.get();
		const url = value?.url ?? "";
		const model = value?.model ?? "";
		if (url.length === 0 || model.length === 0) return void 0;
		const apiKeyEnv = value?.apiKeyEnv ?? "VISION_API_KEY";
		const resolved = await credentials.resolve(credentialRef(apiKeyEnv));
		if (resolved === void 0) return void 0;
		return {
			url,
			model,
			apiKey: resolved.value
		};
	}
	/** Encode image bytes as a base64 string for the data URL payload. */
	function toBase64(data) {
		return Buffer.from(data).toString("base64");
	}
	const modelImages = new ModelImageBridge({
		async describe({ attachment, userText, signal }) {
			const attachmentId = String(attachment.attachmentId);
			refs.set(attachmentId, attachment);
			const facts = await resolvedFacts();
			if (facts === void 0) throw new Error("vision model is not configured (set it in the right-side panel)");
			const stored = await attachments.readImage(attachment, signal);
			return (await describeWithLowInformationRetry((prompt) => describeImage(facts.url, facts.apiKey, facts.model, toBase64(stored.data), attachment.mediaType, prompt, signal), userText)).description;
		},
		onStart(entry) {
			activities.start(entry, entry.sessionId === void 0 ? void 0 : activeTurn(entry.sessionId));
		},
		onDescription(entry) {
			persistDescription({
				time: Date.now(),
				attachmentId: entry.attachmentId,
				sessionId: entry.sessionId,
				description: entry.description
			});
			activities.complete(entry);
		},
		onFailure(entry) {
			activities.fail(entry);
		},
		failureText(error) {
			return error instanceof Error ? error.message : String(error);
		}
	});
	const historyDir = join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), ".visual_plugin");
	const videoCoordinator = createVideoCoordinator({
		rootDir: join(historyDir, "videos"),
		mediaEngine: createSystemMediaEngine(),
		frameInterpreter: createVisionFrameInterpreter(resolvedFacts)
	});
	/** Record one completed description into both the in-memory feed and disk. */
	function persistDescription(entry) {
		recordRecent(recent, entry, MAX_RECENT_IMAGES, historyLimit());
		record(historyDir, entry);
	}
	/** Rebuild the recent feed and the description cache from persisted history. */
	async function restoreHistory() {
		const records = (await load(historyDir)).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
		const latestByImage = /* @__PURE__ */ new Map();
		for (const record of records) {
			recordRecent(recent, record, MAX_RECENT_IMAGES, historyLimit());
			latestByImage.set(record.attachmentId, record.description);
		}
		for (const [attachmentId, description] of latestByImage) modelImages.seedResolved(attachmentId, description);
	}
	restoreHistory();
	ctx.tools.register(defineTool({
		name: "vision_describe",
		description: "Send one previously attached user image to the configured vision model and return its description. Use this only for a later user question that the existing [视觉描述] text cannot answer. Do not call it in the same turn that introduced the image: that image has already been analyzed. Pass the attachmentId shown in the [视觉描述] block.",
		parameters: {
			attachmentId: {
				type: "string",
				required: true,
				description: "The image attachment id from the [视觉描述] block."
			},
			prompt: {
				type: "string",
				description: "Optional specific question about the image; defaults to a general description."
			}
		},
		output: {
			schema: {
				type: "object",
				properties: { description: { type: "string" } },
				additionalProperties: false
			},
			render: (_args, value) => {
				const description = value.description;
				return [{
					type: "text",
					text: typeof description === "string" ? description : JSON.stringify(value)
				}];
			}
		},
		timeoutMs: 6e4,
		async execute(args, exec) {
			const attachmentId = String(args.attachmentId);
			const ref = refs.get(attachmentId);
			if (ref === void 0) throw new Error(`vision_describe: unknown attachment ${args.attachmentId}`);
			const cached = modelImages.cachedDescription(attachmentId);
			if (cached !== void 0 && exec.agent !== void 0 && isSameTurnAttachmentToolCall(exec.agent.session.events, attachmentId, String(exec.callId))) return { description: cached };
			const facts = await resolvedFacts();
			if (facts === void 0) throw new Error("vision_describe: vision model is not configured");
			const stored = await attachments.readImage(ref, exec.signal);
			const result = await describeImage(facts.url, facts.apiKey, facts.model, toBase64(stored.data), ref.mediaType, args.prompt, exec.signal);
			persistDescription({
				time: Date.now(),
				attachmentId: String(ref.attachmentId),
				sessionId: exec.agent === void 0 ? void 0 : String(exec.agent.session.id),
				description: result.description
			});
			return { description: result.description };
		}
	}));
	ctx.tools.register(defineTool({
		name: "video_describe",
		description: "Analyze one plugin-owned video identified by a [视频ID] marker. Use this when the user asks about a selected video. The tool sends extracted keyframes to the configured vision model and returns timestamped visual evidence; synthesize that evidence with the current text model into the final answer. Do not claim to hear audio.",
		parameters: {
			videoId: {
				type: "string",
				required: true,
				description: "The opaque id shown after [视频ID]."
			},
			prompt: {
				type: "string",
				description: "The user question to answer from visible video evidence."
			}
		},
		output: {
			schema: {
				type: "object",
				properties: {
					videoId: { type: "string" },
					fileName: { type: "string" },
					durationSeconds: { type: "number" },
					prompt: { type: "string" },
					evidence: { type: "array" },
					warnings: { type: "array" }
				},
				additionalProperties: false
			},
			render: (_args, value) => {
				const result = value;
				const evidence = result.evidence.map((item) => {
					return `[${item.timestampsSeconds.map((time) => `${time.toFixed(3)}s`).join(", ")}] ${item.description}`;
				}).join("\n\n");
				return [{
					type: "text",
					text: `Video: ${result.fileName} (${result.durationSeconds.toFixed(3)}s)\nQuestion: ${result.prompt}\nTimestamped visual evidence:\n${evidence}\nWarnings: ${result.warnings.join("; ") || "none"}\nUse the current text model to synthesize a direct answer from this evidence. Do not infer audio.`
				}];
			}
		},
		timeoutMs: 10 * 6e4,
		async execute(args, exec) {
			if (exec.agent === void 0) throw new Error("video_describe requires a calling agent");
			const result = await (await videoCoordinator).analyze({
				sessionId: String(exec.agent.session.id),
				videoId: String(args.videoId),
				...typeof args.prompt === "string" ? { prompt: args.prompt } : {},
				signal: exec.signal
			});
			return {
				videoId: result.videoId,
				fileName: result.fileName,
				durationSeconds: result.durationSeconds,
				prompt: result.prompt,
				evidence: result.evidence.map((item) => ({
					frameIds: [...item.frameIds],
					timestampsSeconds: [...item.timestampsSeconds],
					description: item.description
				})),
				warnings: [...result.warnings]
			};
		}
	}));
	ctx.get("systemPrompt").section({
		name: "vision-bridge",
		order: 115,
		text: "The user may attach images. The model request contains a private replacement for each image: \"[视觉描述] <description>\\n[附件] <attachmentId>\". The visible chat still keeps the original image. Answer the current message directly from the supplied description. Do not call vision_describe in the same turn that introduces the image. Only call it for a later user question when the existing description lacks detail. The plugin may also stage a selected video as \"[视频] <filename>\\n[视频ID] <videoId>\". Call video_describe for questions about that video, then answer using its timestamped visual evidence. Video analysis has no audio evidence, so never claim what was heard."
	});
	registerVisionAdapter(ctx, (messages, context) => modelImages.rewrite(messages, context));
	const writeJson = (res, body, status = 200) => {
		res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
		res.end(JSON.stringify(body));
	};
	const readJsonBody = async (req) => {
		const chunks = [];
		for await (const chunk of req) chunks.push(chunk);
		const text = Buffer.concat(chunks).toString("utf8");
		try {
			return JSON.parse(text);
		} catch {
			return {};
		}
	};
	const stringField = (body, key) => typeof body[key] === "string" ? body[key] : "";
	const registerPanelRoutes = (ws) => {
		ctx.effect(async () => registerVideoRoutes(ws, await videoCoordinator, { sessionExists: (sessionId) => ctx.sessions.get(SessionId(sessionId)) !== void 0 }));
		const configView = async () => {
			const value = scope.get();
			const apiKeyEnv = value.apiKeyEnv || "VISION_API_KEY";
			let keyConfigured = false;
			try {
				keyConfigured = (await credentials.describe(credentialRef(apiKeyEnv))).configured;
			} catch {
				keyConfigured = false;
			}
			return {
				url: value.url,
				model: value.model,
				apiKeyEnv,
				keyConfigured,
				historyLimit: value.historyLimit === void 0 ? 20 : value.historyLimit
			};
		};
		ctx.effect(() => ws.register({
			kind: "exact",
			path: "/vision-bridge/config",
			async handler(req, res) {
				if (req.method === "GET") {
					writeJson(res, {
						ok: true,
						config: await configView()
					});
					return;
				}
				if (req.method !== "POST") {
					writeJson(res, {
						ok: false,
						error: {
							code: "HTTP",
							message: "method not allowed"
						}
					}, 405);
					return;
				}
				const body = await readJsonBody(req);
				const url = stringField(body, "url");
				const model = stringField(body, "model");
				const apiKey = stringField(body, "apiKey");
				if (url.length === 0 || model.length === 0) {
					writeJson(res, {
						ok: false,
						error: {
							code: "CONFIG",
							message: "url and model are required"
						}
					});
					return;
				}
				try {
					const patch = {
						url,
						model
					};
					const historyLimit = body.historyLimit;
					if (historyLimit === null) patch.historyLimit = null;
					else if (typeof historyLimit === "number" && Number.isFinite(historyLimit)) patch.historyLimit = historyLimit;
					await scope.update(patch);
					const apiKeyEnv = scope.get().apiKeyEnv || "VISION_API_KEY";
					if (apiKey.length > 0) await credentials.set(credentialRef(apiKeyEnv), apiKey);
					writeJson(res, {
						ok: true,
						config: await configView()
					});
				} catch (error) {
					writeJson(res, {
						ok: false,
						error: {
							code: "CONFIG",
							message: error instanceof Error ? error.message : String(error)
						}
					});
				}
			}
		}), "vision-bridge: route /vision-bridge/config");
		ctx.effect(() => ws.register({
			kind: "exact",
			path: "/vision-bridge/test",
			async handler(req, res) {
				const body = await readJsonBody(req);
				const url = stringField(body, "url");
				const model = stringField(body, "model");
				const apiKey = stringField(body, "apiKey");
				if (url.length === 0 || model.length === 0) {
					writeJson(res, {
						ok: false,
						error: {
							code: "CONFIG",
							message: "url and model are required"
						}
					});
					return;
				}
				const key = apiKey.length > 0 ? apiKey : (await resolvedFacts())?.apiKey;
				if (key === void 0) {
					writeJson(res, {
						ok: false,
						error: {
							code: "AUTH",
							message: "api_key is required"
						}
					});
					return;
				}
				writeJson(res, await testConnection(url, key, model));
			}
		}), "vision-bridge: route /vision-bridge/test");
		ctx.effect(() => ws.register({
			kind: "exact",
			path: "/vision-bridge/balance",
			async handler(_req, res) {
				const facts = await resolvedFacts();
				if (facts === void 0) {
					writeJson(res, {
						supported: false,
						error: {
							code: "CONFIG",
							message: "vision model is not configured"
						}
					});
					return;
				}
				writeJson(res, await queryBalance(facts.url, facts.apiKey));
			}
		}), "vision-bridge: route /vision-bridge/balance");
		ctx.effect(() => ws.register({
			kind: "exact",
			path: "/vision-bridge/recent",
			async handler(req, res) {
				const sessionId = new URL(req.url ?? "/vision-bridge/recent", "http://localhost").searchParams.get("sessionId");
				writeJson(res, { entries: sessionId === null || sessionId.length === 0 ? [] : recent.filter((entry) => entry.sessionId === sessionId) });
			}
		}), "vision-bridge: route /vision-bridge/recent");
		ctx.effect(() => ws.register({
			kind: "exact",
			path: "/vision-bridge/activity",
			async handler(req, res) {
				const sessionId = new URL(req.url ?? "/vision-bridge/activity", "http://localhost").searchParams.get("sessionId") ?? "";
				writeJson(res, { entries: sessionId.length === 0 ? [] : activities.forSession(sessionId).map(withTurnState) });
			}
		}), "vision-bridge: route /vision-bridge/activity");
	};
	if (webServer !== void 0) registerPanelRoutes(webServer);
	else ctx.inject(["webServer"], (scoped) => {
		registerPanelRoutes(scoped.webServer);
	});
}
//#endregion
export { apply, inject, name };
