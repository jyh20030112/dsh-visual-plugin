window.__ModuleLoader__.load({
	id: "dsh-visual-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region \0dsh-css:/Users/jyh030112/Desktop/Dev/dsh-visual-plugin/src/client/DescriptionCopyButton.module.css.mjs
		const css$4 = ".By_5sW_copy{min-height:28px;color:var(--dsw-alias-label-tertiary,#777);cursor:pointer;font:inherit;background:0 0;border:0;border-radius:7px;align-items:center;gap:5px;padding:4px 8px;font-size:11px;transition:background-color .12s,color .12s;display:inline-flex}.By_5sW_copy:hover{background:var(--dsw-alias-interactive-bg-hover,#7f7f7f1a);color:var(--dsw-alias-label-primary,currentColor)}.By_5sW_copy:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}.By_5sW_copy svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;width:14px;height:14px}";
		const tagId$4 = "dsh-visual-plugin/DescriptionCopyButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var DescriptionCopyButton_module_css_default = { "copy": "By_5sW_copy" };
		//#endregion
		//#region src/client/DescriptionCopyButton.tsx
		/** Copy text even on plain-HTTP deployments where Clipboard API is absent. */
		async function copyText(text) {
			if (navigator.clipboard !== void 0) try {
				await navigator.clipboard.writeText(text);
				return;
			} catch {}
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.append(textarea);
			textarea.select();
			const copied = document.execCommand("copy");
			textarea.remove();
			if (!copied) throw new Error("copy command failed");
		}
		/** Compact copy action shared by inline and panel descriptions. */
		function DescriptionCopyButton({ text, t }) {
			const [copied, setCopied] = (0, react.useState)(false);
			const resetTimer = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => () => {
				if (resetTimer.current !== void 0) clearTimeout(resetTimer.current);
			}, []);
			const copy = (0, react.useCallback)(async () => {
				try {
					await copyText(text);
					setCopied(true);
					if (resetTimer.current !== void 0) clearTimeout(resetTimer.current);
					resetTimer.current = setTimeout(() => {
						setCopied(false);
					}, 1600);
				} catch {
					setCopied(false);
				}
			}, [text]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: DescriptionCopyButton_module_css_default.copy,
				onClick: () => void copy(),
				"aria-label": t("action.copyDescription"),
				title: t("action.copyDescription"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 20 20",
					"aria-hidden": "true",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "7",
						y: "3",
						width: "9",
						height: "11",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13 16H6a2 2 0 0 1-2-2V7" })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: copied ? t("status.copied") : t("action.copy") })]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/jyh030112/Desktop/Dev/dsh-visual-plugin/src/client/VisionBridgePanel.module.css.mjs
		const css$3 = ".qP09Ta_panel{z-index:1000;width:var(--vision-bridge-panel-width,min(440px, 94vw));box-sizing:border-box;border-left:1px solid var(--dsw-alias-border-l2,#0000001f);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#0f1115);flex-direction:column;font-size:13px;display:flex;position:fixed;inset:0 0 0 auto;overflow:hidden;box-shadow:-12px 0 36px #00000024}@media (width>=760px){#root:has(.qP09Ta_panel){--vision-bridge-panel-width:clamp(360px, 32vw, 440px);width:calc(100% - var(--vision-bridge-panel-width));transition:width var(--ds-transition-duration-slow,.3s) var(--ds-ease-in-out,ease)}}.qP09Ta_header{justify-content:space-between;align-items:flex-start;gap:20px;padding:22px 22px 16px;display:flex}.qP09Ta_title{letter-spacing:-.01em;font-size:18px;font-weight:650;display:block}.qP09Ta_headerHint{color:var(--dsw-alias-label-tertiary,#62666b);margin:5px 0 0;font-size:12px;line-height:1.45}.qP09Ta_close{width:32px;height:32px;color:var(--dsw-alias-label-secondary,#43454a);cursor:pointer;background:0 0;border:0;border-radius:9px;flex:none;place-items:center;padding:0;display:grid}.qP09Ta_close:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000f);color:var(--dsw-alias-label-primary,#0f1115)}.qP09Ta_close:focus-visible,.qP09Ta_tab:focus-visible,.qP09Ta_tabActive:focus-visible,.qP09Ta_actions button:focus-visible,.qP09Ta_textAction:focus-visible,.qP09Ta_previewPlaceholder:focus-visible,.qP09Ta_historyToggle:focus-visible,.qP09Ta_historyToggleExpanded:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}.qP09Ta_close svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-width:1.7px;width:18px;height:18px}.qP09Ta_tabs{background:var(--dsw-specific-selector,#f5f6f7);border-radius:11px;grid-template-columns:1fr 1fr;gap:4px;margin:0 22px;padding:4px;display:grid}.qP09Ta_tab,.qP09Ta_tabActive{min-height:36px;color:var(--dsw-alias-label-tertiary,#62666b);cursor:pointer;font:inherit;background:0 0;border:0;border-radius:8px;padding:7px 14px;font-weight:550;transition:background-color .12s,box-shadow .12s,color .12s;position:relative}.qP09Ta_tab:hover{color:var(--dsw-alias-label-primary,#0f1115)}.qP09Ta_tabActive{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#0f1115);box-shadow:0 1px 4px #00000014}.qP09Ta_tabDot{background:var(--dsw-alias-state-business-primary,#4176e6);border-radius:50%;width:5px;height:5px;margin-left:5px;position:absolute;top:9px}.qP09Ta_content{overscroll-behavior:contain;scrollbar-gutter:stable;flex:1;min-height:0;padding:20px 22px 28px;overflow-y:auto}.qP09Ta_recentList{flex-direction:column;gap:18px;display:flex}.qP09Ta_view{flex-direction:column;gap:16px;display:flex}.qP09Ta_intro{flex-direction:column;align-items:flex-start;gap:9px;display:flex}.qP09Ta_hint{color:var(--dsw-alias-label-secondary,#4f5359);margin:0;line-height:1.6}.qP09Ta_statusReady,.qP09Ta_statusPending,.qP09Ta_latestBadge{border-radius:999px;align-items:center;min-height:22px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex}.qP09Ta_statusReady{background:var(--dsw-alias-state-success-tertiary,#e6faed);color:var(--dsw-alias-state-success-primary,#22a955)}.qP09Ta_statusPending{background:var(--dsw-alias-state-warn-tertiary,#fef5e7);color:var(--dsw-alias-state-warn-label,#b26720)}.qP09Ta_card{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-2,#fff);border-radius:14px;flex-direction:column;gap:13px;padding:16px;display:flex}.qP09Ta_sectionHeading,.qP09Ta_recentHeading,.qP09Ta_entryTopline,.qP09Ta_entryFooter{justify-content:space-between;align-items:center;gap:12px;display:flex}.qP09Ta_historyToggle,.qP09Ta_historyToggleExpanded{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-module-platform,#f5f6f7);width:100%;min-height:36px;color:var(--dsw-alias-label-secondary,#4f5359);cursor:pointer;font:inherit;border-radius:9px;justify-content:space-between;align-items:center;padding:7px 10px;font-size:12px;font-weight:550;display:flex}.qP09Ta_historyToggle:hover,.qP09Ta_historyToggleExpanded{background:var(--dsw-alias-interactive-bg-hover,#7f7f7f1a);color:var(--dsw-alias-label-primary,#0f1115)}.qP09Ta_historyToggle svg,.qP09Ta_historyToggleExpanded svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;width:15px;height:15px;transition:transform .12s}.qP09Ta_historyToggleExpanded svg{transform:rotate(180deg)}.qP09Ta_historyList{flex-direction:column;gap:10px;padding-top:2px;display:flex}.qP09Ta_historyItem{border-left:2px solid var(--dsw-alias-border-l3,#00000029);background:var(--dsw-alias-bg-module-platform,#f5f6f7);border-radius:0 8px 8px 0;padding:11px 12px}.qP09Ta_historyItemHeader{justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;display:flex}.qP09Ta_historyItemHeader time{color:var(--dsw-alias-label-caption,#969ba1);font-size:10px}.qP09Ta_historyItem>p,.qP09Ta_historyEmpty{color:var(--dsw-alias-label-secondary,#4f5359);overflow-wrap:anywhere;white-space:pre-wrap;margin:0;font-size:12px;line-height:1.6}.qP09Ta_historyEmpty{color:var(--dsw-alias-label-tertiary,#70747a);padding:10px 2px 2px}.qP09Ta_sectionHeading>span,.qP09Ta_recentHeading p,.qP09Ta_entryTopline time{color:var(--dsw-alias-label-tertiary,#777b81);font-size:11px}.qP09Ta_recentHeading{align-items:flex-start}.qP09Ta_recentHeading p{margin:5px 0 0;line-height:1.45}.qP09Ta_subtitle{margin:0;font-size:14px;font-weight:650}.qP09Ta_field{color:var(--dsw-alias-label-secondary,#4f5359);flex-direction:column;gap:7px;font-size:12px;font-weight:550;display:flex}.qP09Ta_field input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#00000029);background:var(--dsw-specific-input-major,#fff);width:100%;min-height:40px;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;border-radius:9px;outline:none;padding:9px 11px;transition:border-color .12s,box-shadow .12s}.qP09Ta_field input::placeholder{color:var(--dsw-alias-label-caption,#9aa0a6)}.qP09Ta_field input:focus{border-color:var(--dsw-alias-state-business-primary,#4176e6);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176e6) 16%, transparent)}.qP09Ta_actions{gap:8px;padding-top:2px;display:flex}.qP09Ta_actions button{cursor:pointer;min-height:38px;font:inherit;border-radius:9px;flex:1;padding:8px 12px;font-weight:600}.qP09Ta_primaryAction{border:1px solid var(--dsw-alias-button-info-fill,#4176e6);background:var(--dsw-alias-button-info-fill,#4176e6);color:var(--dsw-static-neutral-00,#fff)}.qP09Ta_primaryAction:hover{border-color:var(--dsw-alias-button-info-hover,#5686fe);background:var(--dsw-alias-button-info-hover,#5686fe)}.qP09Ta_secondaryAction{border:1px solid var(--dsw-alias-border-l3,#00000029);background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#0f1115)}.qP09Ta_secondaryAction:hover{background:var(--dsw-alias-interactive-bg-hover-solid,#f1f3f5)}.qP09Ta_actions button:disabled{cursor:not-allowed;opacity:.45}.qP09Ta_textAction{color:var(--dsw-alias-label-secondary,#4f5359);cursor:pointer;font:inherit;background:0 0;border:0;border-radius:7px;flex:none;padding:5px 7px;font-size:12px}.qP09Ta_textAction:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000f);color:var(--dsw-alias-label-primary,#0f1115)}.qP09Ta_note,.qP09Ta_ok,.qP09Ta_error,.qP09Ta_balanceLine{margin:0;font-size:12px;line-height:1.5}.qP09Ta_note{color:var(--dsw-alias-label-tertiary,#70747a)}.qP09Ta_ok{color:var(--dsw-alias-state-success-primary,#22a955)}.qP09Ta_error{color:var(--dsw-alias-state-error-primary,#ec1313)}.qP09Ta_balanceLine{color:var(--dsw-alias-label-secondary,#4f5359)}.qP09Ta_empty{box-sizing:border-box;border:1px dashed var(--dsw-alias-border-l3,#00000029);background:var(--dsw-alias-bg-module-platform,#f7f8f9);text-align:center;border-radius:16px;flex-direction:column;justify-content:center;align-items:center;min-height:300px;padding:44px 32px;display:flex}.qP09Ta_emptyIcon{background:var(--dsw-alias-state-business-tertiary,#e4edfd);width:52px;height:52px;color:var(--dsw-alias-state-business-primary,#4176e6);border-radius:15px;place-items:center;margin-bottom:17px;display:grid}.qP09Ta_emptyIcon svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;width:27px;height:27px}.qP09Ta_empty h3{margin:0 0 8px;font-size:14px}.qP09Ta_empty p{max-width:280px;color:var(--dsw-alias-label-tertiary,#70747a);margin:0;font-size:12px;line-height:1.65}.qP09Ta_entry{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-2,#fff);border-radius:16px;overflow:hidden}.qP09Ta_preview{background:var(--dsw-alias-bg-module-platform,#f5f6f7);place-items:center;min-height:210px;max-height:280px;display:grid;overflow:hidden}.qP09Ta_thumb{object-fit:contain;width:100%;height:240px;display:block}.qP09Ta_previewPlaceholder{width:100%;min-height:210px;color:var(--dsw-alias-label-tertiary,#70747a);cursor:pointer;font:inherit;background:0 0;border:0;font-size:12px}.qP09Ta_entryBody{border-top:1px solid var(--dsw-alias-border-l1,#0000000f);flex-direction:column;gap:12px;padding:16px;display:flex}.qP09Ta_latestBadge{background:var(--dsw-alias-state-business-tertiary,#e4edfd);color:var(--dsw-alias-state-business-primary,#4176e6)}.qP09Ta_description{color:var(--dsw-alias-label-primary,#0f1115);overflow-wrap:anywhere;white-space:pre-wrap;margin:0;font-size:13px;line-height:1.7}.qP09Ta_entryFooter{min-width:0;padding-top:2px}.qP09Ta_meta{min-width:0;color:var(--dsw-alias-label-caption,#969ba1);font-family:var(--ds-font-family-code,monospace);text-overflow:ellipsis;white-space:nowrap;margin:0;font-size:10px;overflow:hidden}@media (width<=520px){.qP09Ta_header{padding:18px 16px 14px}.qP09Ta_tabs{margin:0 16px}.qP09Ta_content{padding:16px}}@media (prefers-reduced-motion:reduce){.qP09Ta_tab,.qP09Ta_tabActive,.qP09Ta_field input{transition:none}}";
		const tagId$3 = "dsh-visual-plugin/VisionBridgePanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var VisionBridgePanel_module_css_default = {
			"historyItemHeader": "qP09Ta_historyItemHeader",
			"previewPlaceholder": "qP09Ta_previewPlaceholder",
			"tabs": "qP09Ta_tabs",
			"subtitle": "qP09Ta_subtitle",
			"latestBadge": "qP09Ta_latestBadge",
			"empty": "qP09Ta_empty",
			"header": "qP09Ta_header",
			"card": "qP09Ta_card",
			"tabActive": "qP09Ta_tabActive",
			"ok": "qP09Ta_ok",
			"headerHint": "qP09Ta_headerHint",
			"thumb": "qP09Ta_thumb",
			"historyToggle": "qP09Ta_historyToggle",
			"historyToggleExpanded": "qP09Ta_historyToggleExpanded",
			"actions": "qP09Ta_actions",
			"meta": "qP09Ta_meta",
			"recentList": "qP09Ta_recentList",
			"hint": "qP09Ta_hint",
			"content": "qP09Ta_content",
			"statusPending": "qP09Ta_statusPending",
			"entryFooter": "qP09Ta_entryFooter",
			"intro": "qP09Ta_intro",
			"sectionHeading": "qP09Ta_sectionHeading",
			"primaryAction": "qP09Ta_primaryAction",
			"balanceLine": "qP09Ta_balanceLine",
			"textAction": "qP09Ta_textAction",
			"field": "qP09Ta_field",
			"tab": "qP09Ta_tab",
			"secondaryAction": "qP09Ta_secondaryAction",
			"preview": "qP09Ta_preview",
			"panel": "qP09Ta_panel",
			"description": "qP09Ta_description",
			"close": "qP09Ta_close",
			"historyList": "qP09Ta_historyList",
			"view": "qP09Ta_view",
			"tabDot": "qP09Ta_tabDot",
			"statusReady": "qP09Ta_statusReady",
			"historyItem": "qP09Ta_historyItem",
			"error": "qP09Ta_error",
			"title": "qP09Ta_title",
			"entryTopline": "qP09Ta_entryTopline",
			"historyEmpty": "qP09Ta_historyEmpty",
			"note": "qP09Ta_note",
			"emptyIcon": "qP09Ta_emptyIcon",
			"entry": "qP09Ta_entry",
			"recentHeading": "qP09Ta_recentHeading",
			"entryBody": "qP09Ta_entryBody"
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
			const [view, setView] = (0, react.useState)("config");
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
			const [expandedHistory, setExpandedHistory] = (0, react.useState)({});
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
			const loadThumbnail = (0, react.useCallback)(async (attachmentId, ownerSessionId) => {
				const resolvedSessionId = ownerSessionId ?? sessionId;
				if (api === void 0 || resolvedSessionId === void 0) return;
				const value = resultValue(await api.sessions.attachment({
					sessionId: resolvedSessionId,
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
				const timer = setInterval(() => {
					refresh();
				}, 2e3);
				return () => clearInterval(timer);
			}, [
				open,
				loadConfig,
				refresh
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				for (const entry of history) if (thumbnails[entry.attachmentId] === void 0) loadThumbnail(entry.attachmentId, entry.sessionId);
			}, [
				history,
				loadThumbnail,
				open,
				thumbnails
			]);
			if (!open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: VisionBridgePanel_module_css_default.panel,
				role: "dialog",
				"aria-label": t("panel.title"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: VisionBridgePanel_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: VisionBridgePanel_module_css_default.title,
							children: t("panel.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: VisionBridgePanel_module_css_default.headerHint,
							children: t("panel.shortHint")
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: VisionBridgePanel_module_css_default.close,
							onClick: actions.close,
							"aria-label": t("action.close"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
								viewBox: "0 0 20 20",
								"aria-hidden": "true",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m5 5 10 10M15 5 5 15" })
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
						className: VisionBridgePanel_module_css_default.tabs,
						role: "tablist",
						"aria-label": t("panel.title"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": view === "config",
							className: view === "config" ? VisionBridgePanel_module_css_default.tabActive : VisionBridgePanel_module_css_default.tab,
							onClick: () => {
								setView("config");
							},
							children: t("tab.config")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "tab",
							"aria-selected": view === "recent",
							className: view === "recent" ? VisionBridgePanel_module_css_default.tabActive : VisionBridgePanel_module_css_default.tab,
							onClick: () => {
								setView("recent");
							},
							children: [t("tab.recent"), history.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: VisionBridgePanel_module_css_default.tabDot,
								"aria-hidden": "true"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: VisionBridgePanel_module_css_default.content,
						children: [view === "config" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							role: "tabpanel",
							className: VisionBridgePanel_module_css_default.view,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: VisionBridgePanel_module_css_default.intro,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: configured ? VisionBridgePanel_module_css_default.statusReady : VisionBridgePanel_module_css_default.statusPending,
										children: configured ? t("status.configured") : t("status.notConfigured")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: VisionBridgePanel_module_css_default.hint,
										children: t("panel.hint")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: VisionBridgePanel_module_css_default.card,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: VisionBridgePanel_module_css_default.sectionHeading,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
												className: VisionBridgePanel_module_css_default.subtitle,
												children: t("config.title")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("config.securityHint") })]
										}),
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
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: VisionBridgePanel_module_css_default.primaryAction,
												onClick: () => void save(),
												disabled: api === void 0,
												children: t("action.save")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: VisionBridgePanel_module_css_default.secondaryAction,
												onClick: () => void testConnection(),
												disabled: testing || url.length === 0 || model.length === 0,
												children: testing ? t("status.testing") : t("action.test")
											})]
										}),
										saved && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: VisionBridgePanel_module_css_default.ok,
											children: t("status.saved")
										}),
										testResult !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: testResult.ok ? VisionBridgePanel_module_css_default.ok : VisionBridgePanel_module_css_default.error,
											children: testResult.ok ? t("status.testOk", { latency: String(testResult.latencyMs ?? 0) }) : t("status.testFail", { message: testResult.error?.message ?? "unknown" })
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: VisionBridgePanel_module_css_default.card,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: VisionBridgePanel_module_css_default.sectionHeading,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
												className: VisionBridgePanel_module_css_default.subtitle,
												children: t("balance.title")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: VisionBridgePanel_module_css_default.textAction,
												onClick: () => void refresh(),
												children: t("action.refresh")
											})]
										}),
										balance === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: VisionBridgePanel_module_css_default.note,
											children: t("status.loading")
										}),
										balance !== null && !balance.supported && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: VisionBridgePanel_module_css_default.note,
											children: balance.error !== void 0 ? t("balance.unavailable", { message: balance.error.message }) : t("balance.unsupported")
										}),
										balance !== null && balance.supported && (balance.lines ?? []).map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: VisionBridgePanel_module_css_default.balanceLine,
											children: t("balance.line", {
												currency: line.currency,
												available: String(line.available),
												total: String(line.total)
											})
										}, `${line.currency}-${index}`))
									]
								})
							]
						}), view === "recent" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							role: "tabpanel",
							className: VisionBridgePanel_module_css_default.view,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: VisionBridgePanel_module_css_default.recentHeading,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: VisionBridgePanel_module_css_default.subtitle,
									children: t("history.title")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("history.latestHint") })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: VisionBridgePanel_module_css_default.textAction,
									onClick: () => void refresh(),
									children: t("action.refresh")
								})]
							}), history.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: VisionBridgePanel_module_css_default.empty,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: VisionBridgePanel_module_css_default.emptyIcon,
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
											viewBox: "0 0 24 24",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "9",
													cy: "9",
													r: "1.5"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m5 17 4.5-4.5 3.2 3.2 2-2L20 19" })
											]
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("history.emptyTitle") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("history.empty") })
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: VisionBridgePanel_module_css_default.recentList,
								children: history.map((entry) => {
									const latest = entry.descriptions[0];
									if (latest === void 0) return null;
									const older = entry.descriptions.slice(1);
									const expanded = expandedHistory[entry.attachmentId] === true;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
										className: VisionBridgePanel_module_css_default.entry,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: VisionBridgePanel_module_css_default.preview,
											children: thumbnails[entry.attachmentId] === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: VisionBridgePanel_module_css_default.previewPlaceholder,
												onClick: () => void loadThumbnail(entry.attachmentId, entry.sessionId),
												children: t("history.loadPreview")
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
												className: VisionBridgePanel_module_css_default.thumb,
												src: thumbnails[entry.attachmentId],
												alt: t("history.previewAlt")
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: VisionBridgePanel_module_css_default.entryBody,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: VisionBridgePanel_module_css_default.entryTopline,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: VisionBridgePanel_module_css_default.latestBadge,
														children: t("history.latest")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
														dateTime: new Date(latest.time).toISOString(),
														children: new Date(latest.time).toLocaleString()
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: VisionBridgePanel_module_css_default.description,
													children: latest.description
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
													className: VisionBridgePanel_module_css_default.entryFooter,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														className: VisionBridgePanel_module_css_default.meta,
														title: entry.attachmentId,
														children: t("history.attachments", { id: entry.attachmentId })
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DescriptionCopyButton, {
														text: latest.description,
														t
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: expanded ? VisionBridgePanel_module_css_default.historyToggleExpanded : VisionBridgePanel_module_css_default.historyToggle,
													"aria-expanded": expanded,
													onClick: () => {
														setExpandedHistory((current) => ({
															...current,
															[entry.attachmentId]: !expanded
														}));
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: expanded ? t("history.collapse", { count: String(older.length) }) : t("history.expand", { count: String(older.length) }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
														viewBox: "0 0 16 16",
														"aria-hidden": "true",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m4 6 4 4 4-4" })
													})]
												}),
												expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: VisionBridgePanel_module_css_default.historyList,
													children: older.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														className: VisionBridgePanel_module_css_default.historyEmpty,
														children: t("history.noEarlier")
													}) : older.map((description, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: VisionBridgePanel_module_css_default.historyItem,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: VisionBridgePanel_module_css_default.historyItemHeader,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
																dateTime: new Date(description.time).toISOString(),
																children: new Date(description.time).toLocaleString()
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DescriptionCopyButton, {
																text: description.description,
																t
															})]
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: description.description })]
													}, `${description.time}-${index}`))
												})
											]
										})]
									}, entry.attachmentId);
								})
							})]
						})]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/jyh030112/Desktop/Dev/dsh-visual-plugin/src/client/VisionBridgeToggle.module.css.mjs
		const css$2 = ".qjmUlW_toggle{color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;background:0 0;border:none;border-radius:6px;align-items:center;gap:6px;padding:6px 10px;font-size:13px;display:inline-flex}.qjmUlW_toggle:hover,.qjmUlW_toggle[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover,#7f7f7f1a);color:var(--dsw-alias-label-primary,inherit)}.qjmUlW_toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}";
		const tagId$2 = "dsh-visual-plugin/VisionBridgeToggle.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var VisionBridgeToggle_module_css_default = { "toggle": "qjmUlW_toggle" };
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
		//#region \0dsh-css:/Users/jyh030112/Desktop/Dev/dsh-visual-plugin/src/client/VisionDescribeCard.module.css.mjs
		const css$1 = ".l93hJq_card{border-left:3px solid var(--dsw-alias-state-business-primary,#4d6bfe);background:var(--dsw-alias-bg-module-platform,#f5f6f7);color:var(--dsw-alias-label-primary,inherit);border-radius:6px;flex-direction:column;gap:4px;padding:8px 12px;display:flex}.l93hJq_running{border-left-color:var(--dsw-alias-state-warn-primary,#d8a300)}.l93hJq_failed,.l93hJq_interrupted{border-left-color:var(--dsw-alias-state-error-primary,#e05252)}.l93hJq_cardHeader{justify-content:space-between;align-items:center;gap:12px;display:flex}.l93hJq_running .l93hJq_label:after{content:\"\";background:currentColor;border-radius:50%;width:6px;height:6px;margin-left:7px;animation:1.1s ease-in-out infinite l93hJq_vision-pulse;display:inline-block}.l93hJq_label{opacity:.7;text-transform:uppercase;letter-spacing:.04em;font-size:11px;font-weight:600}.l93hJq_text{overflow-wrap:anywhere;margin:0;font-size:13px;line-height:1.5}@keyframes l93hJq_vision-pulse{0%,to{opacity:.25}50%{opacity:1}}";
		const tagId$1 = "dsh-visual-plugin/VisionDescribeCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var VisionDescribeCard_module_css_default = {
			"interrupted": "l93hJq_interrupted",
			"label": "l93hJq_label",
			"vision-pulse": "l93hJq_vision-pulse",
			"card": "l93hJq_card",
			"cardHeader": "l93hJq_cardHeader",
			"text": "l93hJq_text",
			"failed": "l93hJq_failed",
			"running": "l93hJq_running"
		};
		//#endregion
		//#region src/client/VisionDescribeCard.tsx
		/** One visual treatment for every description path. */
		function VisionDescriptionCard({ status, text, label, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${VisionDescribeCard_module_css_default.card} ${VisionDescribeCard_module_css_default[status]}`,
				"data-vision-description-status": status,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: VisionDescribeCard_module_css_default.cardHeader,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: VisionDescribeCard_module_css_default.label,
						children: label
					}), status === "completed" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DescriptionCopyButton, {
						text,
						t
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: VisionDescribeCard_module_css_default.text,
					children: text
				})]
			});
		}
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
			if (!("kind" in block)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VisionDescriptionCard, {
				status: "running",
				label: t("panel.title"),
				text: t("status.describing"),
				t
			});
			if (block.kind !== "tool-result") return null;
			const description = descriptionOf(block.content);
			const failed = block.isError === true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VisionDescriptionCard, {
				status: failed ? "failed" : "completed",
				label: t("panel.title"),
				text: failed ? t("status.describeFail", { message: description }) : description,
				t
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/jyh030112/Desktop/Dev/dsh-visual-plugin/src/client/VisionActivityCards.module.css.mjs
		const css = "._9MVeNW_list{flex-direction:column;gap:8px;width:100%;display:flex}";
		const tagId = "dsh-visual-plugin/VisionActivityCards.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var VisionActivityCards_module_css_default = { "list": "_9MVeNW_list" };
		//#endregion
		//#region src/client/VisionActivityCards.tsx
		const pendingLoads = /* @__PURE__ */ new Map();
		function fetchActivities(sessionId) {
			const existing = pendingLoads.get(sessionId);
			if (existing !== void 0) return existing;
			const pending = fetch(`/vision-bridge/activity?sessionId=${encodeURIComponent(sessionId)}`).then(async (response) => (await response.json()).entries ?? []).finally(() => {
				pendingLoads.delete(sessionId);
			});
			pendingLoads.set(sessionId, pending);
			return pending;
		}
		function useActivities(sessionId, poll) {
			const [entries, setEntries] = (0, react.useState)([]);
			(0, react.useEffect)(() => {
				let disposed = false;
				const load = async () => {
					try {
						const values = await fetchActivities(sessionId);
						if (!disposed) setEntries(values);
					} catch {
						if (!disposed) setEntries([]);
					}
				};
				load();
				if (!poll) return () => {
					disposed = true;
				};
				const timer = setInterval(() => {
					load();
				}, 500);
				return () => {
					disposed = true;
					clearInterval(timer);
				};
			}, [poll, sessionId]);
			return entries;
		}
		function cardStatus(entry) {
			return entry.status === "running" && entry.turnClosed ? "interrupted" : entry.status;
		}
		function cardText(entry, t) {
			if (entry.status === "completed") return entry.description ?? "…";
			if (entry.status === "failed") return t("status.describeFail", { message: entry.error ?? "unknown" });
			return entry.turnClosed ? t("status.interrupted") : t("status.describing");
		}
		function ActivityList({ entries, t }) {
			if (entries.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: VisionActivityCards_module_css_default.list,
				"data-vision-activity-list": true,
				children: entries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VisionDescriptionCard, {
					status: cardStatus(entry),
					label: t("panel.title"),
					text: cardText(entry, t),
					t
				}, entry.operationId))
			});
		}
		function locationClosed(location) {
			if (location.kind === "step") return location.step.status === "closed" || location.turn.status === "closed";
			return location.kind === "turn" && location.turn.status === "closed";
		}
		/** Live and settled cards anchored directly after their source image message. */
		function InlineVisionDescriptions(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActivityList, {
				entries: useActivities(String(props.sessionId), !locationClosed(props.node.location)).filter((entry) => entry.messageId === props.node.data.messageId),
				t: props.t
			});
		}
		//#endregion
		//#region src/client/vision-activity-definition.ts
		function attachmentIdsOf(content) {
			const ids = [];
			for (const block of content) {
				if (block.type === "image") {
					ids.push(String(block.attachment.attachmentId));
					continue;
				}
				if (block.type === "tool-result") ids.push(...attachmentIdsOf(block.content));
			}
			return [...new Set(ids)];
		}
		function imageMessage(event) {
			const message = event.type === "user/message" ? event.data : event.type === "tool/result" ? event.data.message : void 0;
			if (message === void 0) return void 0;
			const attachmentIds = attachmentIdsOf(message.content);
			return attachmentIds.length === 0 ? void 0 : {
				messageId: String(message.id),
				attachmentIds
			};
		}
		/** Anchor a model-hidden activity projection immediately after its image message. */
		const visionActivityDefinition = {
			kind: "vision-activity",
			target: "chat",
			match: (event) => {
				const message = imageMessage(event);
				return message === void 0 ? null : {
					id: message.messageId,
					role: "start"
				};
			},
			start: (_context, match) => {
				const message = imageMessage(match.event);
				if (message === void 0) throw new Error("vision-activity start requires an image-bearing message");
				return message;
			},
			update: (context) => context.state,
			buildViewNode: (context) => {
				if (context.start === void 0 || context.state === void 0) return null;
				return {
					key: context.key,
					kind: "vision-activity",
					id: context.id,
					target: "chat",
					anchorSeq: context.start.event.seq + .1,
					location: context.start.location,
					visibility: "visible",
					data: context.state
				};
			}
		};
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
			"panel.shortHint": "让纯文本模型也能理解图片",
			"panel.hint": "主模型无视觉能力时，将图片转发到已配置的视觉模型进行描述。",
			"tab.config": "配置",
			"tab.recent": "图片",
			"config.title": "模型配置",
			"config.securityHint": "凭据安全保存",
			"field.url": "接口地址",
			"field.url.placeholder": "https://api.deepseek.com",
			"field.model": "模型名称",
			"field.model.placeholder": "glm-4v-flash",
			"field.apiKey": "API Key",
			"field.apiKey.placeholder": "仅填写一次，保存后不再回显",
			"action.save": "保存配置",
			"action.test": "测试连接",
			"action.refresh": "刷新",
			"action.close": "关闭视觉桥接面板",
			"action.copy": "复制",
			"action.copyDescription": "复制描述",
			"status.saved": "已保存",
			"status.notConfigured": "未配置视觉模型",
			"status.configured": "已配置",
			"status.testing": "测试中…",
			"status.loading": "正在加载…",
			"status.copied": "已复制",
			"status.describing": "正在解析图片…",
			"status.describeFail": "视觉解析失败：{message}",
			"status.interrupted": "视觉解析已中断",
			"status.testOk": "连接成功（{latency} ms）",
			"status.testFail": "连接失败：{message}",
			"status.keyConfigured": "API Key 已配置",
			"status.keyMissing": "API Key 未配置",
			"balance.title": "剩余额度",
			"balance.unsupported": "该服务暂不提供额度查询",
			"balance.unavailable": "额度查询失败：{message}",
			"balance.line": "{currency} 可用 {available}（总额 {total}）",
			"history.title": "图片",
			"history.latestHint": "每张图片展示最新描述；最近更新的图片排在最上方。",
			"history.emptyTitle": "还没有视觉描述",
			"history.empty": "在会话中发送一张图片并提出问题，视觉桥接会自动解析，最新结果将显示在这里。",
			"history.latest": "最新",
			"history.expand": "历史描述（{count}）",
			"history.collapse": "收起历史（{count}）",
			"history.noEarlier": "这张图片还没有更早的描述。",
			"history.loadPreview": "点击加载图片预览",
			"history.previewAlt": "最近描述的图片预览",
			"history.attachments": "附件 {id}"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"panel.title": "Vision Bridge",
			"panel.shortHint": "Help text-only models understand images",
			"panel.hint": "When the main model has no vision, forward images to the configured vision model for description.",
			"tab.config": "Configuration",
			"tab.recent": "Images",
			"config.title": "Model configuration",
			"config.securityHint": "Credentials stored securely",
			"field.url": "Endpoint URL",
			"field.url.placeholder": "https://api.deepseek.com",
			"field.model": "Model name",
			"field.model.placeholder": "glm-4v-flash",
			"field.apiKey": "API Key",
			"field.apiKey.placeholder": "Enter once; never echoed after saving",
			"action.save": "Save",
			"action.test": "Test connection",
			"action.refresh": "Refresh",
			"action.close": "Close Vision Bridge panel",
			"action.copy": "Copy",
			"action.copyDescription": "Copy description",
			"status.saved": "Saved",
			"status.notConfigured": "Vision model not configured",
			"status.configured": "Configured",
			"status.testing": "Testing…",
			"status.loading": "Loading…",
			"status.copied": "Copied",
			"status.describing": "Analyzing image…",
			"status.describeFail": "Vision analysis failed: {message}",
			"status.interrupted": "Vision analysis was interrupted",
			"status.testOk": "Connected ({latency} ms)",
			"status.testFail": "Connection failed: {message}",
			"status.keyConfigured": "API Key configured",
			"status.keyMissing": "API Key not configured",
			"balance.title": "Remaining balance",
			"balance.unsupported": "Balance query is not supported by this service",
			"balance.unavailable": "Balance query failed: {message}",
			"balance.line": "{currency} available {available} of {total}",
			"history.title": "Images",
			"history.latestHint": "Each image shows its latest description; the most recently updated image appears first.",
			"history.emptyTitle": "No visual description yet",
			"history.empty": "Send an image with a question in the conversation. Vision Bridge will analyze it automatically and show the latest result here.",
			"history.latest": "Latest",
			"history.expand": "Description history ({count})",
			"history.collapse": "Hide history ({count})",
			"history.noEarlier": "There are no earlier descriptions for this image.",
			"history.loadPreview": "Load image preview",
			"history.previewAlt": "Preview of the latest described image",
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
			"locale",
			"conversationEvents"
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
			ctx.conversationEvents.register(visionActivityDefinition);
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
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "vision-activity",
				locale: NS,
				inject: () => ({})
			}, InlineVisionDescriptions));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map