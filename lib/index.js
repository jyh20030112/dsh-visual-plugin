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
function registerVisionAdapter(ctx) {
	const llm = ctx.get("llm");
	if (llm === void 0) return;
	llm.registerAdapter([VISION_PROVIDER], new VisionBridgeAdapter(ctx));
}
/** The wrapper: image-input admission plus delegated deepseek streaming. */
var VisionBridgeAdapter = class extends LlmAdapter {
	ctx;
	constructor(ctx) {
		super();
		this.ctx = ctx;
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: "DeepSeek (Vision)"
		};
	}
	listModels(provider) {
		return this.ctx.llm.listModels(UNDERLYING_PROVIDER);
	}
	resolveModel(provider, model, signal) {
		return this.ctx.llm.resolveModelInfo(UNDERLYING_PROVIDER, model, signal).then((info) => ({
			...info,
			inputModalities: [...info.inputModalities ?? [], "image"]
		}));
	}
	async *stream(options) {
		const rewritten = rewriteImageBlocks(options.messages);
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
/** Replace every image block with a text placeholder the model can act on. */
function rewriteImageBlocks(messages) {
	let changed = false;
	const rewritten = messages.map((message) => {
		if (!message.content.some((block) => block.type === "image")) return message;
		changed = true;
		return {
			...message,
			content: message.content.map((block) => block.type === "image" ? {
				type: "text",
				text: `<image attachmentId="${block.attachment.attachmentId}">`
			} : block)
		};
	});
	return changed ? rewritten : messages;
}
//#endregion
//#region src/index.ts
/** Vision-bridge plugin name. */
const name = "vision-bridge";
/** Required services: the tool registry only; every other seam is optional. */
const inject = ["tools"];
/**
* The host half: pre-step image interception, the describe tool, the panel's
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
	let scope;
	if (settings !== void 0) scope = settings.register(NS, VisionBridgeConfig, { base: {
		url: "",
		model: "",
		apiKeyEnv: DEFAULT_API_KEY_ENV
	} });
	/** Resolve the configured endpoint facts, or undefined when unconfigured. */
	async function resolvedFacts() {
		const value = scope?.get();
		const url = value?.url ?? "";
		const model = value?.model ?? "";
		if (url.length === 0 || model.length === 0) return void 0;
		const apiKeyEnv = value?.apiKeyEnv ?? "VISION_API_KEY";
		if (credentials === void 0) return void 0;
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
	/** Replace every image block in one message with its description text. */
	async function describeImagesInMessage(message, facts, signal) {
		const imageBlock = message.content.find((block) => block.type === "image");
		if (imageBlock === void 0) return void 0;
		const ref = imageBlock.attachment;
		refs.set(String(ref.attachmentId), ref);
		if (attachments === void 0) return void 0;
		const stored = await attachments.readImage(ref, signal);
		return {
			text: (await describeImage(facts.url, facts.apiKey, facts.model, toBase64(stored.data), ref.mediaType, void 0, signal)).description,
			attachmentId: String(ref.attachmentId)
		};
	}
	/** Replace every image block with a failure text so the main model can answer instead of failing. */
	function replaceWithFailure(messages, reason) {
		return {
			kind: "enter",
			messages: messages.map((message) => ({
				...message,
				content: message.content.map((block) => block.type === "image" ? {
					type: "text",
					text: `[视觉描述失败] ${reason}`
				} : block)
			}))
		};
	}
	ctx.on("agent/pre-step", async ({ messages, signal }, next) => {
		if (!messages.some((message) => message.content.some((block) => block.type === "image"))) return next();
		if (attachments === void 0) return replaceWithFailure(messages, "the attachment service is unavailable");
		const facts = await resolvedFacts();
		if (facts === void 0) return replaceWithFailure(messages, "vision model is not configured (set it in the right-side panel)");
		const rewritten = [];
		for (const message of messages) {
			const described = await describeImagesInMessage(message, facts, signal);
			if (described === void 0) {
				rewritten.push(message);
				continue;
			}
			rewritten.push({
				...message,
				content: message.content.map((block) => block.type === "image" ? {
					type: "text",
					text: `[视觉描述] ${described.text}\n[附件] ${described.attachmentId}`
				} : block)
			});
			recent.unshift({
				time: Date.now(),
				attachmentId: described.attachmentId,
				description: described.text
			});
			if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
		}
		return {
			kind: "enter",
			messages: rewritten
		};
	});
	ctx.tools.register(defineTool({
		name: "vision_describe",
		description: "Send one previously attached user image to the configured vision model and return its description. Pass the attachmentId shown in the [视觉描述] block of the user message. The main model has no vision, so this tool is how you answer follow-up questions about a specific image.",
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
			const ref = refs.get(String(args.attachmentId));
			if (ref === void 0) throw new Error(`vision_describe: unknown attachment ${args.attachmentId}`);
			const facts = await resolvedFacts();
			if (facts === void 0) throw new Error("vision_describe: vision model is not configured");
			if (attachments === void 0) throw new Error("vision_describe: attachment service is unavailable");
			const stored = await attachments.readImage(ref, exec.signal);
			const result = await describeImage(facts.url, facts.apiKey, facts.model, toBase64(stored.data), ref.mediaType, args.prompt, exec.signal);
			recent.unshift({
				time: Date.now(),
				attachmentId: String(ref.attachmentId),
				description: result.description
			});
			if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
			return { description: result.description };
		}
	}));
	const systemPrompt = ctx.get("systemPrompt");
	if (systemPrompt !== void 0) systemPrompt.section({
		name: "vision-bridge",
		order: 115,
		text: "The user may attach images. Each attached image is described before it reaches you: you see \"[视觉描述] <description>\\n[附件] <attachmentId>\" (or \"<image attachmentId=\\\"…\\\">\" as a fallback). To answer a follow-up question about a specific image, call the vision_describe tool with that attachmentId."
	});
	if (ctx.get("llm") !== void 0) registerVisionAdapter(ctx);
	else ctx.inject(["llm"], (scoped) => {
		registerVisionAdapter(scoped);
	});
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
