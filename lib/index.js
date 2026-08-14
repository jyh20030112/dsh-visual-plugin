import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { LlmAdapter } from "@deepseek-ai/dsh-llm";
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
	apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV)
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
		const rewritten = await this.rewrite(options.messages, options.signal);
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
* Record the newest description for an attachment.
*
* The automatic adapter bridge and the explicit follow-up tool can both
* describe the same image. The panel models its history as one card per
* attachment, so replace any previous rows before inserting the newest one.
*/
function upsertRecent(recent, entry, maxEntries) {
	for (let index = recent.length - 1; index >= 0; index -= 1) if (recent[index]?.attachmentId === entry.attachmentId) recent.splice(index, 1);
	recent.unshift(entry);
	if (recent.length > maxEntries) recent.length = maxEntries;
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
	constructor(options) {
		this.options = options;
	}
	/** Return a completed automatic description without starting new work. */
	cachedDescription(attachmentId) {
		return this.resolved.get(attachmentId);
	}
	/** Build model-bound copies of messages containing image blocks. */
	async rewrite(messages, signal) {
		let changed = false;
		const rewritten = await Promise.all(messages.map(async (message) => {
			const result = await this.rewriteContent(message.content, userTextOf(message), signal);
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
	async rewriteContent(content, userText, signal) {
		const results = await Promise.all(content.map(async (block) => {
			if (block.type === "tool-result") {
				const nested = await this.rewriteContent(block.content, userText, signal);
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
						text: `[视觉描述] ${await this.descriptionFor(attachment, userText, signal)}\n[附件] ${attachmentId}\n`
					},
					changed: true
				};
			} catch (error) {
				return {
					block: {
						type: "text",
						text: `[视觉描述失败] ${this.options.failureText(error)}\n[附件] ${attachmentId}\n`
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
	async descriptionFor(attachment, userText, signal) {
		const attachmentId = String(attachment.attachmentId);
		const existing = this.pending.get(attachmentId);
		if (existing !== void 0) return existing;
		const pending = this.options.describe({
			attachment,
			userText,
			signal
		}).then((description) => {
			this.resolved.set(attachmentId, description);
			this.options.onDescription({
				attachmentId,
				description
			});
			return description;
		});
		this.pending.set(attachmentId, pending);
		try {
			return await pending;
		} catch (error) {
			if (this.pending.get(attachmentId) === pending) this.pending.delete(attachmentId);
			throw error;
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
	"systemPrompt"
];
/**
* The host half: model-bound image description, the describe tool, the panel's
* HTTP routes, and the wrapper adapter.
* @param ctx - plugin context.
*/
function apply(ctx) {
	const refs = /* @__PURE__ */ new Map();
	const recent = [];
	const MAX_RECENT = 20;
	const settings = ctx.get("settings");
	const credentials = ctx.get("credentials");
	const attachments = ctx.get("attachments");
	const webServer = ctx.get("webServer");
	const scope = settings.register(NS, VisionBridgeConfig, { base: {
		url: "",
		model: "",
		apiKeyEnv: DEFAULT_API_KEY_ENV
	} });
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
		onDescription(entry) {
			upsertRecent(recent, {
				time: Date.now(),
				...entry
			}, MAX_RECENT);
		},
		failureText(error) {
			return error instanceof Error ? error.message : String(error);
		}
	});
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
			upsertRecent(recent, {
				time: Date.now(),
				attachmentId: String(ref.attachmentId),
				description: result.description
			}, MAX_RECENT);
			return { description: result.description };
		}
	}));
	ctx.get("systemPrompt").section({
		name: "vision-bridge",
		order: 115,
		text: "The user may attach images. The model request contains a private replacement for each image: \"[视觉描述] <description>\\n[附件] <attachmentId>\". The visible chat still keeps the original image. Answer the current message directly from the supplied description. Do not call vision_describe in the same turn that introduces the image. Only call it for a later user question when the existing description lacks detail."
	});
	registerVisionAdapter(ctx, (messages, signal) => modelImages.rewrite(messages, signal));
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
				keyConfigured
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
					await scope.update({
						url,
						model
					});
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
			async handler(_req, res) {
				writeJson(res, { entries: recent });
			}
		}), "vision-bridge: route /vision-bridge/recent");
	};
	if (webServer !== void 0) registerPanelRoutes(webServer);
	else ctx.inject(["webServer"], (scoped) => {
		registerPanelRoutes(scoped.webServer);
	});
}
//#endregion
export { apply, inject, name };
