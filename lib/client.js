window.__ModuleLoader__.load({
	id: "dsh-visual-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region \0dsh-css:/home/arch/Desktop/Dev/deepseek_workspace/dsh-visual-plugin/src/client/VisionBridgePanel.module.css.mjs
		const css$2 = "._5cyU7a_hidden{display:none}._5cyU7a_panel{z-index:1000;box-sizing:border-box;background:var(--color-bg-2,#1c1f26);border-left:1px solid var(--color-border,#333);width:360px;max-width:90vw;color:var(--color-text-1,#e6e6e6);flex-direction:column;padding:16px;font-size:13px;display:flex;position:fixed;top:0;bottom:0;right:0;overflow-y:auto;box-shadow:-8px 0 24px #00000040}._5cyU7a_header{justify-content:space-between;align-items:center;margin-bottom:8px;display:flex}._5cyU7a_title{font-size:15px;font-weight:600}._5cyU7a_close{color:inherit;cursor:pointer;background:0 0;border:none;border-radius:4px;padding:4px 8px;font-size:14px}._5cyU7a_close:hover{background:var(--color-bg-3,#2a2e37)}._5cyU7a_hint{opacity:.7;margin:0 0 12px;line-height:1.5}._5cyU7a_section{flex-direction:column;gap:8px;margin-bottom:16px;display:flex}._5cyU7a_field{flex-direction:column;gap:4px;display:flex}._5cyU7a_field input{border:1px solid var(--color-border,#444);background:var(--color-bg-1,#14161b);color:inherit;border-radius:6px;padding:6px 8px;font-size:13px}._5cyU7a_actions{flex-wrap:wrap;gap:8px;display:flex}._5cyU7a_actions button{border:1px solid var(--color-border,#444);background:var(--color-bg-3,#2a2e37);color:inherit;cursor:pointer;border-radius:6px;padding:6px 12px;font-size:13px}._5cyU7a_actions button:disabled{opacity:.5;cursor:not-allowed}._5cyU7a_note{opacity:.8;margin:0;font-size:12px}._5cyU7a_ok{color:#4caf50;margin:0;font-size:12px}._5cyU7a_error{color:#f44336;margin:0;font-size:12px}._5cyU7a_subtitle{margin:4px 0;font-size:13px;font-weight:600}._5cyU7a_entry{border:1px solid var(--color-border,#333);background:var(--color-bg-1,#14161b);border-radius:8px;align-items:flex-start;gap:10px;padding:8px;display:flex}._5cyU7a_thumb{object-fit:cover;border-radius:6px;flex-shrink:0;width:56px;height:56px}._5cyU7a_thumbPlaceholder{border:1px dashed var(--color-border,#555);width:56px;height:56px;color:inherit;opacity:.6;cursor:pointer;background:0 0;border-radius:6px;flex-shrink:0}._5cyU7a_entryBody{flex-direction:column;gap:4px;min-width:0;display:flex}._5cyU7a_description{overflow-wrap:anywhere;margin:0;font-size:12px;line-height:1.5}._5cyU7a_meta{opacity:.55;overflow-wrap:anywhere;margin:0;font-size:11px}";
		const tagId$2 = "dsh-visual-plugin/VisionBridgePanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var VisionBridgePanel_module_css_default = {
			"section": "_5cyU7a_section",
			"meta": "_5cyU7a_meta",
			"title": "_5cyU7a_title",
			"header": "_5cyU7a_header",
			"hidden": "_5cyU7a_hidden",
			"close": "_5cyU7a_close",
			"field": "_5cyU7a_field",
			"panel": "_5cyU7a_panel",
			"entry": "_5cyU7a_entry",
			"actions": "_5cyU7a_actions",
			"subtitle": "_5cyU7a_subtitle",
			"hint": "_5cyU7a_hint",
			"note": "_5cyU7a_note",
			"ok": "_5cyU7a_ok",
			"thumb": "_5cyU7a_thumb",
			"thumbPlaceholder": "_5cyU7a_thumbPlaceholder",
			"entryBody": "_5cyU7a_entryBody",
			"description": "_5cyU7a_description",
			"error": "_5cyU7a_error"
		};
		//#endregion
		//#region src/client/VisionBridgePanel.tsx
		/**
		* Vision bridge floating panel: configure the vision endpoint, test the
		* connection, watch recent image descriptions with their thumbnails, and read
		* the remaining balance. Pure presentation: every fact arrives through the
		* composed props (the store seat, the connection inject face, and the
		* standard `useSessions` hook); the panel itself holds only transient form
		* and fetch state.
		* @module dsh-visual-plugin/client/VisionBridgePanel
		*/
		/** Unwrap a unary RPC response to its business result value, or undefined on failure. */
		function resultValue(response) {
			return response.result.ok ? response.result.value : void 0;
		}
		/**
		* The floating panel body.
		* @param props - composed props for the overlay entry.
		*/
		function VisionBridgePanel(props) {
			const { useStore, actions, t, api, useSessions } = props;
			const open = useStore((s) => s.open);
			const sessionId = useSessions((s) => s).current;
			const [url, setUrl] = (0, react.useState)("");
			const [model, setModel] = (0, react.useState)("");
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [configured, setConfigured] = (0, react.useState)(false);
			const [keyConfigured, setKeyConfigured] = (0, react.useState)(false);
			const [saved, setSaved] = (0, react.useState)(false);
			const [testing, setTesting] = (0, react.useState)(false);
			const [testResult, setTestResult] = (0, react.useState)(null);
			const [balance, setBalance] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)([]);
			const [thumbnails, setThumbnails] = (0, react.useState)({});
			/** Load the stored config and key state from the host config route. */
			const loadConfig = (0, react.useCallback)(async () => {
				try {
					const body = await (await fetch("/vision-bridge/config")).json();
					if (body.ok !== true || body.config === void 0) return;
					setUrl(body.config.url ?? "");
					setModel(body.config.model ?? "");
					setConfigured((body.config.url?.length ?? 0) > 0 && (body.config.model?.length ?? 0) > 0);
					setKeyConfigured(body.config.keyConfigured ?? false);
				} catch {}
			}, []);
			/** Save the form: url/model plus an optional new key through the host config route. */
			const save = (0, react.useCallback)(async () => {
				try {
					const body = await (await fetch("/vision-bridge/config", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							url,
							model,
							apiKey
						})
					})).json();
					if (body.ok === true) {
						setConfigured(url.length > 0 && model.length > 0);
						setSaved(true);
						if (body.config !== void 0) setKeyConfigured(body.config.keyConfigured ?? false);
						if (apiKey.length > 0) setApiKey("");
					}
				} catch {}
			}, [
				url,
				model,
				apiKey
			]);
			/** POST a connection test to the host route. */
			const testConnection = (0, react.useCallback)(async () => {
				setTesting(true);
				setTestResult(null);
				try {
					setTestResult(await (await fetch("/vision-bridge/test", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							url,
							model,
							apiKey
						})
					})).json());
				} catch (error) {
					setTestResult({
						ok: false,
						latencyMs: 0,
						error: {
							code: "NETWORK",
							message: String(error)
						}
					});
				} finally {
					setTesting(false);
				}
			}, [
				url,
				model,
				apiKey
			]);
			/** Load balance and recent history from the host routes. */
			const refresh = (0, react.useCallback)(async () => {
				try {
					setBalance(await (await fetch("/vision-bridge/balance")).json());
				} catch {
					setBalance({
						supported: false,
						error: {
							code: "NETWORK",
							message: "fetch failed"
						}
					});
				}
				try {
					setHistory((await (await fetch("/vision-bridge/recent")).json()).entries ?? []);
				} catch {
					setHistory([]);
				}
			}, []);
			/** Resolve one attachment's bytes for thumbnail display through the session seam. */
			const loadThumbnail = (0, react.useCallback)(async (attachmentId) => {
				if (api === void 0 || sessionId === void 0) return;
				const value = resultValue(await api.sessions.attachment({
					sessionId,
					attachmentId
				}));
				if (value !== void 0) setThumbnails((prev) => ({
					...prev,
					[attachmentId]: `data:${value.attachment.mediaType};base64,${value.data}`
				}));
			}, [api, sessionId]);
			(0, react.useEffect)(() => {
				if (!open) return;
				loadConfig();
				refresh();
			}, [
				open,
				loadConfig,
				refresh
			]);
			if (!open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: VisionBridgePanel_module_css_default.panel,
				role: "dialog",
				"aria-label": t("panel.title"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: VisionBridgePanel_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: VisionBridgePanel_module_css_default.title,
							children: t("panel.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: VisionBridgePanel_module_css_default.close,
							onClick: actions.close,
							"aria-label": t("panel.title"),
							children: "✕"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: VisionBridgePanel_module_css_default.hint,
						children: t("panel.hint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: VisionBridgePanel_module_css_default.section,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: VisionBridgePanel_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("field.url") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: url,
									onChange: (e) => setUrl(e.target.value),
									placeholder: t("field.url.placeholder")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: VisionBridgePanel_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("field.model") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: model,
									onChange: (e) => setModel(e.target.value),
									placeholder: t("field.model.placeholder")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: VisionBridgePanel_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("field.apiKey") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "password",
									value: apiKey,
									onChange: (e) => setApiKey(e.target.value),
									placeholder: keyConfigured ? t("status.keyConfigured") : t("status.keyMissing")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: VisionBridgePanel_module_css_default.actions,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void save(),
										disabled: api === void 0,
										children: t("action.save")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void testConnection(),
										disabled: testing || url.length === 0 || model.length === 0,
										children: testing ? t("status.testing") : t("action.test")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void refresh(),
										children: t("action.refresh")
									})
								]
							}),
							saved && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: VisionBridgePanel_module_css_default.note,
								children: t("status.saved")
							}),
							!configured && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: VisionBridgePanel_module_css_default.note,
								children: t("status.notConfigured")
							}),
							testResult !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: testResult.ok ? VisionBridgePanel_module_css_default.ok : VisionBridgePanel_module_css_default.error,
								children: testResult.ok ? t("status.testOk", { latency: String(testResult.latencyMs ?? 0) }) : t("status.testFail", { message: testResult.error?.message ?? "unknown" })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: VisionBridgePanel_module_css_default.section,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: VisionBridgePanel_module_css_default.subtitle,
								children: t("balance.title")
							}),
							balance === null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: VisionBridgePanel_module_css_default.note,
								children: [t("action.refresh"), "…"]
							}),
							balance !== null && !balance.supported && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: VisionBridgePanel_module_css_default.note,
								children: balance.error !== void 0 ? t("balance.unavailable", { message: balance.error.message }) : t("balance.unsupported")
							}),
							balance !== null && balance.supported && (balance.lines ?? []).map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: VisionBridgePanel_module_css_default.note,
								children: t("balance.line", {
									currency: line.currency,
									available: String(line.available),
									total: String(line.total)
								})
							}, `${line.currency}-${index}`))
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: VisionBridgePanel_module_css_default.section,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: VisionBridgePanel_module_css_default.subtitle,
								children: t("history.title")
							}),
							history.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: VisionBridgePanel_module_css_default.note,
								children: t("history.empty")
							}),
							history.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								className: VisionBridgePanel_module_css_default.entry,
								children: [thumbnails[entry.attachmentId] === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: VisionBridgePanel_module_css_default.thumbPlaceholder,
									onClick: () => void loadThumbnail(entry.attachmentId),
									children: "img"
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									className: VisionBridgePanel_module_css_default.thumb,
									src: thumbnails[entry.attachmentId],
									alt: ""
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: VisionBridgePanel_module_css_default.entryBody,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: VisionBridgePanel_module_css_default.description,
										children: entry.description
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: VisionBridgePanel_module_css_default.meta,
										children: t("history.attachments", { id: entry.attachmentId })
									})]
								})]
							}, entry.attachmentId))
						]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/arch/Desktop/Dev/deepseek_workspace/dsh-visual-plugin/src/client/VisionBridgeToggle.module.css.mjs
		const css$1 = ".rNwIGq_toggle{color:inherit;cursor:pointer;background:0 0;border:none;border-radius:6px;align-items:center;gap:6px;padding:6px 10px;font-size:13px;display:inline-flex}.rNwIGq_toggle:hover,.rNwIGq_toggle[aria-pressed=true]{background:var(--color-bg-3,#2a2e37)}";
		const tagId$1 = "dsh-visual-plugin/VisionBridgeToggle.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var VisionBridgeToggle_module_css_default = { "toggle": "rNwIGq_toggle" };
		//#endregion
		//#region src/client/VisionBridgeToggle.tsx
		/**
		* The sidebar toggle button; the label comes from the shared store's open
		* state.
		* @param props - composed props for the footer-action entry.
		*/
		function VisionBridgeToggle(props) {
			const { useStore, actions, t } = props;
			const open = useStore((s) => s.open);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: VisionBridgeToggle_module_css_default.toggle,
				onClick: actions.toggle,
				"aria-pressed": open,
				title: t("panel.title"),
				children: t("panel.title")
			});
		}
		//#endregion
		//#region \0dsh-css:/home/arch/Desktop/Dev/deepseek_workspace/dsh-visual-plugin/src/client/VisionDescribeCard.module.css.mjs
		const css = ".Wc_19q_card{border-left:3px solid var(--color-accent,#4d6bfe);background:var(--color-bg-2,#1c1f26);border-radius:6px;flex-direction:column;gap:4px;padding:8px 12px;display:flex}.Wc_19q_label{opacity:.7;text-transform:uppercase;letter-spacing:.04em;font-size:11px;font-weight:600}.Wc_19q_text{overflow-wrap:anywhere;margin:0;font-size:13px;line-height:1.5}";
		const tagId = "dsh-visual-plugin/VisionDescribeCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var VisionDescribeCard_module_css_default = {
			"card": "Wc_19q_card",
			"text": "Wc_19q_text",
			"label": "Wc_19q_label"
		};
		//#endregion
		//#region src/client/VisionDescribeCard.tsx
		/** Extract the description text from a settled result node's text blocks. */
		function descriptionOf(content) {
			const texts = [];
			for (const item of content) {
				if (item.type !== "text") continue;
				const text = item.text;
				if (typeof text === "string") texts.push(text);
			}
			return texts.join("\n") || "…";
		}
		/**
		* Render one settled `vision_describe` call.
		* @param props - composed props for the keyed Tool slot.
		*/
		function VisionDescribeCard(props) {
			const { block, t } = props;
			if (!("kind" in block) || block.kind !== "tool-result") return null;
			const description = descriptionOf(block.content);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: VisionDescribeCard_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: VisionDescribeCard_module_css_default.label,
					children: t("panel.title")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: VisionDescribeCard_module_css_default.text,
					children: description
				})]
			});
		}
		//#endregion
		//#region src/client/store.ts
		/**
		* Vision bridge panel store: the floating panel's open/closed state, shared
		* between the sidebar toggle and the overlay entry. Panel content (config,
		* history, balance) is fetched on demand by the panel component, not held
		* here.
		* @module dsh-visual-plugin/client/store
		*/
		/**
		* Create the panel store handle.
		* @returns the live store handle bound by the registering entries.
		*/
		function createVisionBridgeStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({ open: false }),
				actions: {
					toggle: (d) => {
						d.open = !d.open;
					},
					close: (d) => {
						d.open = false;
					}
				}
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** `vision-bridge` namespace dictionaries (the vision bridge panel's copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"panel.title": "视觉桥接",
			"panel.hint": "主模型无视觉能力时，将图片转发到已配置的视觉模型进行描述。",
			"field.url": "接口地址",
			"field.url.placeholder": "https://api.deepseek.com",
			"field.model": "模型名称",
			"field.model.placeholder": "glm-4v-flash",
			"field.apiKey": "API Key",
			"field.apiKey.placeholder": "仅填写一次，保存后不再回显",
			"action.save": "保存配置",
			"action.test": "测试连接",
			"action.refresh": "刷新",
			"status.saved": "已保存",
			"status.notConfigured": "未配置视觉模型",
			"status.configured": "已配置",
			"status.testing": "测试中…",
			"status.testOk": "连接成功（{latency} ms）",
			"status.testFail": "连接失败：{message}",
			"status.keyConfigured": "API Key 已配置",
			"status.keyMissing": "API Key 未配置",
			"balance.title": "剩余额度",
			"balance.unsupported": "该服务暂不提供额度查询",
			"balance.unavailable": "额度查询失败：{message}",
			"balance.line": "{currency} 可用 {available}（总额 {total}）",
			"history.title": "最近描述",
			"history.empty": "暂无图片描述记录",
			"history.attachments": "附件 {id}"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"panel.title": "Vision Bridge",
			"panel.hint": "When the main model has no vision, forward images to the configured vision model for description.",
			"field.url": "Endpoint URL",
			"field.url.placeholder": "https://api.deepseek.com",
			"field.model": "Model name",
			"field.model.placeholder": "glm-4v-flash",
			"field.apiKey": "API Key",
			"field.apiKey.placeholder": "Enter once; never echoed after saving",
			"action.save": "Save",
			"action.test": "Test connection",
			"action.refresh": "Refresh",
			"status.saved": "Saved",
			"status.notConfigured": "Vision model not configured",
			"status.configured": "Configured",
			"status.testing": "Testing…",
			"status.testOk": "Connected ({latency} ms)",
			"status.testFail": "Connection failed: {message}",
			"status.keyConfigured": "API Key configured",
			"status.keyMissing": "API Key not configured",
			"balance.title": "Remaining balance",
			"balance.unsupported": "Balance query is not supported by this service",
			"balance.unavailable": "Balance query failed: {message}",
			"balance.line": "{currency} available {available} of {total}",
			"history.title": "Recent descriptions",
			"history.empty": "No image descriptions yet",
			"history.attachments": "Attachment {id}"
		};
		//#endregion
		//#region src/client/index.tsx
		/** Dictionary namespace owned by this plugin. */
		const NS = "vision-bridge";
		/** Required services: the slot registry, connection RPC, and locale registry. */
		const inject = [
			"slots",
			"connection",
			"locale"
		];
		/**
		* Client plugin body: register the floating panel, its sidebar toggle, and
		* the `vision_describe` tool card.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-visual-plugin: dictionaries");
			const api = ctx.get("connection")?.api;
			const visionBridgeStore = createVisionBridgeStore();
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "vision-bridge-toggle",
				locale: NS,
				store: visionBridgeStore,
				inject: () => ({})
			}, VisionBridgeToggle));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "vision-bridge-panel",
				order: 100,
				locale: NS,
				store: visionBridgeStore,
				inject: () => ({ api })
			}, VisionBridgePanel));
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "vision_describe",
				locale: NS
			}, VisionDescribeCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map