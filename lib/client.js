window.__ModuleLoader__.load({
	id: "dsh-visual-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		/** Maximum panel width as a fraction of the viewport width. */
		const PANEL_MAX_RATIO = .9;
		/**
		* Clamp a right-anchored panel width derived from a pointer drag. The panel's
		* left edge is `clientX`, so its width is `innerWidth - clientX`, bounded to
		* `[min, max(innerWidth * maxRatio)]`.
		* @param innerWidth - the viewport width in pixels.
		* @param clientX - the pointer's client X (the panel's left edge).
		* @param min - minimum width (default {@link PANEL_MIN_WIDTH}).
		* @param maxRatio - maximum width as a viewport fraction (default {@link PANEL_MAX_RATIO}).
		* @returns the clamped width in pixels.
		*/
		function clampPanelWidth(innerWidth, clientX, min = 320, maxRatio = PANEL_MAX_RATIO) {
			const max = Math.max(min, Math.round(innerWidth * maxRatio));
			const raw = Math.round(innerWidth - clientX);
			return Math.min(max, Math.max(min, raw));
		}
		//#endregion
		//#region \0dsh-css:src/client/DescriptionCopyButton.module.css.mjs
		const css$5 = ".F5ECwW_copy{min-height:28px;color:var(--dsw-alias-label-tertiary,#777);cursor:pointer;font:inherit;background:0 0;border:0;border-radius:7px;align-items:center;gap:5px;padding:4px 8px;font-size:11px;transition:background-color .12s,color .12s;display:inline-flex}.F5ECwW_copy:hover{background:var(--dsw-alias-interactive-bg-hover,#7f7f7f1a);color:var(--dsw-alias-label-primary,currentColor)}.F5ECwW_copy:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}.F5ECwW_copy svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;width:14px;height:14px}";
		const tagId$5 = "dsh-visual-plugin/DescriptionCopyButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var DescriptionCopyButton_module_css_default = { "copy": "F5ECwW_copy" };
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
		//#region \0dsh-css:src/client/VisionBridgePanel.module.css.mjs
		const css$4 = ".LLI1OG_panel{z-index:1000;width:var(--vision-bridge-panel-width,min(440px, 94vw));box-sizing:border-box;border-left:1px solid var(--dsw-alias-border-l2,#0000001f);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#0f1115);flex-direction:column;font-size:13px;display:flex;position:fixed;inset:0 0 0 auto;overflow:hidden;box-shadow:-12px 0 36px #00000024}@media (width>=760px){#root:has(.LLI1OG_panel){width:calc(100% - var(--vision-bridge-panel-width,min(440px, 94vw)));transition:width var(--ds-transition-duration-slow,.3s) var(--ds-ease-in-out,ease)}}.LLI1OG_resizeHandle{z-index:2;cursor:ew-resize;touch-action:none;width:7px;position:absolute;top:0;bottom:0;left:0}.LLI1OG_resizeHandle:after{content:\"\";background:var(--dsw-alias-border-l2,#0000001f);width:1px;transition:background-color .12s,width .12s;position:absolute;top:0;bottom:0;left:2px}.LLI1OG_resizeHandle:hover:after,.LLI1OG_resizeHandleActive:after{background:var(--dsw-alias-state-business-primary,#4176e6);width:2px;left:1px}.LLI1OG_header{justify-content:space-between;align-items:flex-start;gap:20px;padding:22px 22px 16px;display:flex}.LLI1OG_title{letter-spacing:-.01em;font-size:18px;font-weight:650;display:block}.LLI1OG_headerHint{color:var(--dsw-alias-label-tertiary,#62666b);margin:5px 0 0;font-size:12px;line-height:1.45}.LLI1OG_close{width:32px;height:32px;color:var(--dsw-alias-label-secondary,#43454a);cursor:pointer;background:0 0;border:0;border-radius:9px;flex:none;place-items:center;padding:0;display:grid}.LLI1OG_close:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000f);color:var(--dsw-alias-label-primary,#0f1115)}.LLI1OG_close:focus-visible,.LLI1OG_textAction:focus-visible,.LLI1OG_previewPlaceholder:focus-visible,.LLI1OG_historyToggle:focus-visible,.LLI1OG_historyToggleExpanded:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}.LLI1OG_close svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-width:1.7px;width:18px;height:18px}.LLI1OG_content{overscroll-behavior:contain;scrollbar-gutter:stable;flex:1;min-height:0;padding:20px 22px 28px;overflow-y:auto}.LLI1OG_mediaSelector{grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;display:grid}.LLI1OG_mediaCard,.LLI1OG_mediaCardActive{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-2,#fff);min-width:0;color:var(--dsw-alias-label-secondary,#52565c);cursor:pointer;font:inherit;text-align:left;border-radius:12px;align-items:center;gap:10px;padding:11px;display:flex}.LLI1OG_mediaCardActive{border-color:var(--dsw-alias-state-business-primary,#4176e6);background:var(--dsw-alias-state-business-tertiary,#e9efff);color:var(--dsw-alias-label-primary,#111318)}.LLI1OG_mediaCard:focus-visible,.LLI1OG_mediaCardActive:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}.LLI1OG_mediaCardIcon{background:var(--dsw-alias-bg-module-platform,#f1f2f4);width:30px;height:30px;color:var(--dsw-alias-state-business-primary,#4176e6);border-radius:9px;flex:none;place-items:center;display:grid}.LLI1OG_mediaCard>span:last-child,.LLI1OG_mediaCardActive>span:last-child{flex-direction:column;gap:2px;min-width:0;display:flex}.LLI1OG_mediaCard strong,.LLI1OG_mediaCardActive strong{font-size:12px}.LLI1OG_mediaCard small,.LLI1OG_mediaCardActive small{color:var(--dsw-alias-label-tertiary,#777b81);text-overflow:ellipsis;white-space:nowrap;font-size:10px;overflow:hidden}.LLI1OG_recentList{flex-direction:column;gap:18px;display:flex}.LLI1OG_view{flex-direction:column;gap:16px;display:flex}.LLI1OG_recentHeading,.LLI1OG_entryTopline,.LLI1OG_entryFooter{justify-content:space-between;align-items:center;gap:12px;display:flex}.LLI1OG_recentHeading{align-items:flex-start}.LLI1OG_recentHeading p,.LLI1OG_entryTopline time{color:var(--dsw-alias-label-tertiary,#777b81);font-size:11px}.LLI1OG_recentHeading p{margin:5px 0 0;line-height:1.45}.LLI1OG_subtitle{margin:0;font-size:14px;font-weight:650}.LLI1OG_historyToggle,.LLI1OG_historyToggleExpanded{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-module-platform,#f5f6f7);width:100%;min-height:36px;color:var(--dsw-alias-label-secondary,#4f5359);cursor:pointer;font:inherit;border-radius:9px;justify-content:space-between;align-items:center;padding:7px 10px;font-size:12px;font-weight:550;display:flex}.LLI1OG_historyToggle:hover,.LLI1OG_historyToggleExpanded{background:var(--dsw-alias-interactive-bg-hover,#7f7f7f1a);color:var(--dsw-alias-label-primary,#0f1115)}.LLI1OG_historyToggle svg,.LLI1OG_historyToggleExpanded svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;width:15px;height:15px;transition:transform .12s}.LLI1OG_historyToggleExpanded svg{transform:rotate(180deg)}.LLI1OG_historyList{flex-direction:column;gap:10px;padding-top:2px;display:flex}.LLI1OG_historyItem{border-left:2px solid var(--dsw-alias-border-l3,#00000029);background:var(--dsw-alias-bg-module-platform,#f5f6f7);border-radius:0 8px 8px 0;padding:11px 12px}.LLI1OG_historyItemHeader{justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;display:flex}.LLI1OG_historyItemHeader time{color:var(--dsw-alias-label-caption,#969ba1);font-size:10px}.LLI1OG_historyItem>p,.LLI1OG_historyEmpty{color:var(--dsw-alias-label-secondary,#4f5359);overflow-wrap:anywhere;white-space:pre-wrap;margin:0;font-size:12px;line-height:1.6}.LLI1OG_historyEmpty{color:var(--dsw-alias-label-tertiary,#70747a);padding:10px 2px 2px}.LLI1OG_textAction{color:var(--dsw-alias-label-secondary,#4f5359);cursor:pointer;font:inherit;background:0 0;border:0;border-radius:7px;flex:none;padding:5px 7px;font-size:12px}.LLI1OG_textAction:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000f);color:var(--dsw-alias-label-primary,#0f1115)}.LLI1OG_empty{box-sizing:border-box;border:1px dashed var(--dsw-alias-border-l3,#00000029);background:var(--dsw-alias-bg-module-platform,#f7f8f9);text-align:center;border-radius:16px;flex-direction:column;justify-content:center;align-items:center;min-height:300px;padding:44px 32px;display:flex}.LLI1OG_emptyIcon{background:var(--dsw-alias-state-business-tertiary,#e4edfd);width:52px;height:52px;color:var(--dsw-alias-state-business-primary,#4176e6);border-radius:15px;place-items:center;margin-bottom:17px;display:grid}.LLI1OG_emptyIcon svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;width:27px;height:27px}.LLI1OG_empty h3{margin:0 0 8px;font-size:14px}.LLI1OG_empty p{max-width:280px;color:var(--dsw-alias-label-tertiary,#70747a);margin:0;font-size:12px;line-height:1.65}.LLI1OG_entry{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-2,#fff);border-radius:16px;overflow:hidden}.LLI1OG_preview{background:var(--dsw-alias-bg-module-platform,#f5f6f7);place-items:center;min-height:210px;max-height:280px;display:grid;overflow:hidden}.LLI1OG_videoPreview{background:#08090b;min-height:190px;overflow:hidden}.LLI1OG_videoPreview video{object-fit:contain;background:#08090b;width:100%;height:240px;display:block}.LLI1OG_videoPending{color:#c7cad0;place-items:center;min-height:190px;font-size:12px;display:grid}.LLI1OG_videoName{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:13px;overflow:hidden}.LLI1OG_videoFacts,.LLI1OG_videoWarnings,.LLI1OG_videoError{overflow-wrap:anywhere;margin:0;font-size:11px;line-height:1.55}.LLI1OG_videoFacts{color:var(--dsw-alias-label-tertiary,#777b81)}.LLI1OG_videoWarnings{color:var(--dsw-alias-state-warn-primary,#a66b00)}.LLI1OG_videoError{color:var(--dsw-alias-state-error-primary,#c53d3d)}.LLI1OG_videoEvidence{border-top:1px solid var(--dsw-alias-border-l1,#0000000f);color:var(--dsw-alias-label-secondary,#52565c);padding-top:10px;font-size:11px}.LLI1OG_videoEvidence summary{cursor:pointer;font-weight:600}.LLI1OG_videoEvidence>p,.LLI1OG_videoEvidence div p{white-space:pre-wrap;margin:6px 0;line-height:1.55}.LLI1OG_videoEvidence time{color:var(--dsw-alias-state-business-primary,#4176e6);font-family:var(--ds-font-family-code,monospace)}.LLI1OG_entryFooter time{color:var(--dsw-alias-label-caption,#969ba1);font-size:10px}.LLI1OG_videoActions{align-items:center;gap:4px;display:flex}.LLI1OG_thumb{object-fit:contain;width:100%;height:240px;display:block}.LLI1OG_previewPlaceholder{width:100%;min-height:210px;color:var(--dsw-alias-label-tertiary,#70747a);cursor:pointer;font:inherit;background:0 0;border:0;font-size:12px}.LLI1OG_entryBody{border-top:1px solid var(--dsw-alias-border-l1,#0000000f);flex-direction:column;gap:12px;padding:16px;display:flex}.LLI1OG_latestBadge{background:var(--dsw-alias-state-business-tertiary,#e4edfd);min-height:22px;color:var(--dsw-alias-state-business-primary,#4176e6);border-radius:999px;align-items:center;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex}.LLI1OG_description{color:var(--dsw-alias-label-primary,#0f1115);overflow-wrap:anywhere;white-space:pre-wrap;margin:0;font-size:13px;line-height:1.7}.LLI1OG_entryFooter{min-width:0;padding-top:2px}.LLI1OG_meta{min-width:0;color:var(--dsw-alias-label-caption,#969ba1);font-family:var(--ds-font-family-code,monospace);text-overflow:ellipsis;white-space:nowrap;margin:0;font-size:10px;overflow:hidden}@media (width<=520px){.LLI1OG_header{padding:18px 16px 14px}.LLI1OG_content{padding:16px}}@media (prefers-reduced-motion:reduce){.LLI1OG_resizeHandle:after{transition:none}}";
		const tagId$4 = "dsh-visual-plugin/VisionBridgePanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var VisionBridgePanel_module_css_default = {
			"close": "LLI1OG_close",
			"content": "LLI1OG_content",
			"description": "LLI1OG_description",
			"empty": "LLI1OG_empty",
			"emptyIcon": "LLI1OG_emptyIcon",
			"entry": "LLI1OG_entry",
			"entryBody": "LLI1OG_entryBody",
			"entryFooter": "LLI1OG_entryFooter",
			"entryTopline": "LLI1OG_entryTopline",
			"header": "LLI1OG_header",
			"headerHint": "LLI1OG_headerHint",
			"historyEmpty": "LLI1OG_historyEmpty",
			"historyItem": "LLI1OG_historyItem",
			"historyItemHeader": "LLI1OG_historyItemHeader",
			"historyList": "LLI1OG_historyList",
			"historyToggle": "LLI1OG_historyToggle",
			"historyToggleExpanded": "LLI1OG_historyToggleExpanded",
			"latestBadge": "LLI1OG_latestBadge",
			"mediaCard": "LLI1OG_mediaCard",
			"mediaCardActive": "LLI1OG_mediaCardActive",
			"mediaCardIcon": "LLI1OG_mediaCardIcon",
			"mediaSelector": "LLI1OG_mediaSelector",
			"meta": "LLI1OG_meta",
			"panel": "LLI1OG_panel",
			"preview": "LLI1OG_preview",
			"previewPlaceholder": "LLI1OG_previewPlaceholder",
			"recentHeading": "LLI1OG_recentHeading",
			"recentList": "LLI1OG_recentList",
			"resizeHandle": "LLI1OG_resizeHandle",
			"resizeHandleActive": "LLI1OG_resizeHandleActive",
			"subtitle": "LLI1OG_subtitle",
			"textAction": "LLI1OG_textAction",
			"thumb": "LLI1OG_thumb",
			"title": "LLI1OG_title",
			"videoActions": "LLI1OG_videoActions",
			"videoError": "LLI1OG_videoError",
			"videoEvidence": "LLI1OG_videoEvidence",
			"videoFacts": "LLI1OG_videoFacts",
			"videoName": "LLI1OG_videoName",
			"videoPending": "LLI1OG_videoPending",
			"videoPreview": "LLI1OG_videoPreview",
			"videoWarnings": "LLI1OG_videoWarnings",
			"view": "LLI1OG_view"
		};
		//#endregion
		//#region src/client/VisionBridgePanel.tsx
		/**
		* Vision bridge floating panel: image history and plugin-owned videos. Configuration
		* now lives in the harness settings page (see `VisionBridgeCard`); this panel
		* shows recent image descriptions with their thumbnails and lets the user drag
		* its left edge to resize. Pure presentation: every fact arrives through the
		* composed props (the store seat, the connection inject face, and the standard
		* `useSessions` hook); the panel itself holds only transient fetch state.
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
			const { useStore, actions, t, api, useSessions, videoController } = props;
			const open = useStore((s) => s.open);
			const sessionId = useSessions((s) => s).current;
			const resolvedSessionId = sessionId === void 0 ? "" : String(sessionId);
			const [mediaView, setMediaView] = (0, react.useState)("images");
			const [history, setHistory] = (0, react.useState)([]);
			const [thumbnails, setThumbnails] = (0, react.useState)({});
			const [expandedHistory, setExpandedHistory] = (0, react.useState)({});
			const [width, setWidth] = (0, react.useState)(void 0);
			const [resizing, setResizing] = (0, react.useState)(false);
			const videoState = (0, react.useSyncExternalStore)((listener) => videoController.subscribe(resolvedSessionId, listener), () => videoController.snapshot(resolvedSessionId), () => videoController.snapshot(resolvedSessionId));
			/** Load recent image descriptions for the current session from the host route. */
			const refresh = (0, react.useCallback)(async () => {
				try {
					setHistory((await (await fetch(`/vision-bridge/recent?sessionId=${encodeURIComponent(sessionId ?? "")}`)).json()).entries ?? []);
				} catch {
					setHistory([]);
				}
			}, [sessionId]);
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
				refresh();
				const timer = setInterval(() => {
					refresh();
				}, 2e3);
				return () => clearInterval(timer);
			}, [open, refresh]);
			(0, react.useEffect)(() => {
				if (!open || mediaView !== "videos") return;
				videoController.refresh(resolvedSessionId);
				const timer = setInterval(() => {
					videoController.refresh(resolvedSessionId);
				}, 2e3);
				return () => clearInterval(timer);
			}, [
				mediaView,
				open,
				resolvedSessionId,
				videoController
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
			/** Begin a left-edge drag that resizes the right-anchored panel. */
			const onResizePointerDown = (event) => {
				event.currentTarget.setPointerCapture(event.pointerId);
				setResizing(true);
			};
			const onResizePointerMove = (event) => {
				if (!resizing) return;
				setWidth(clampPanelWidth(window.innerWidth, event.clientX));
			};
			const onResizePointerUp = () => {
				setResizing(false);
			};
			(0, react.useEffect)(() => {
				if (!open) return;
				if (width === void 0) document.documentElement.style.removeProperty("--vision-bridge-panel-width");
				else document.documentElement.style.setProperty("--vision-bridge-panel-width", `${width}px`);
			}, [open, width]);
			if (!open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: VisionBridgePanel_module_css_default.panel,
				role: "dialog",
				"aria-label": t("panel.title"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: resizing ? `${VisionBridgePanel_module_css_default.resizeHandle} ${VisionBridgePanel_module_css_default.resizeHandleActive}` : VisionBridgePanel_module_css_default.resizeHandle,
						role: "separator",
						"aria-orientation": "vertical",
						"aria-label": t("action.resize"),
						onPointerDown: onResizePointerDown,
						onPointerMove: onResizePointerMove,
						onPointerUp: onResizePointerUp,
						onPointerCancel: onResizePointerUp
					}),
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: VisionBridgePanel_module_css_default.content,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: VisionBridgePanel_module_css_default.mediaSelector,
							role: "tablist",
							"aria-label": t("media.select"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "tab",
								"aria-selected": mediaView === "images",
								className: mediaView === "images" ? VisionBridgePanel_module_css_default.mediaCardActive : VisionBridgePanel_module_css_default.mediaCard,
								onClick: () => setMediaView("images"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: VisionBridgePanel_module_css_default.mediaCardIcon,
									"aria-hidden": "true",
									children: "▧"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("history.title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("media.imagesHint") })] })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "tab",
								"aria-selected": mediaView === "videos",
								className: mediaView === "videos" ? VisionBridgePanel_module_css_default.mediaCardActive : VisionBridgePanel_module_css_default.mediaCard,
								onClick: () => setMediaView("videos"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: VisionBridgePanel_module_css_default.mediaCardIcon,
									"aria-hidden": "true",
									children: "▶"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("video.title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("media.videosHint") })] })]
							})]
						}), mediaView === "images" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
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
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: VisionBridgePanel_module_css_default.view,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: VisionBridgePanel_module_css_default.recentHeading,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: VisionBridgePanel_module_css_default.subtitle,
										children: t("video.title")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("video.latestHint") })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: VisionBridgePanel_module_css_default.textAction,
										onClick: () => void videoController.refresh(resolvedSessionId),
										children: t("action.refresh")
									})]
								}),
								videoState.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: VisionBridgePanel_module_css_default.videoError,
									children: videoState.error
								}),
								videoState.videos.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: VisionBridgePanel_module_css_default.empty,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: VisionBridgePanel_module_css_default.emptyIcon,
											"aria-hidden": "true",
											children: "▶"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("video.emptyTitle") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("video.empty") })
									]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: VisionBridgePanel_module_css_default.recentList,
									children: videoState.videos.map((video) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
										className: VisionBridgePanel_module_css_default.entry,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: VisionBridgePanel_module_css_default.videoPreview,
											children: video.normalizedUrl === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: VisionBridgePanel_module_css_default.videoPending,
												children: t("video.status", { status: video.status })
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
												controls: true,
												preload: "metadata",
												src: video.normalizedUrl,
												poster: video.posterUrl,
												"aria-label": video.fileName
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: VisionBridgePanel_module_css_default.entryBody,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: VisionBridgePanel_module_css_default.entryTopline,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
														className: VisionBridgePanel_module_css_default.videoName,
														title: video.fileName,
														children: video.fileName
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: VisionBridgePanel_module_css_default.latestBadge,
														children: t("video.status", { status: video.status })
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: VisionBridgePanel_module_css_default.videoFacts,
													children: video.durationSeconds === void 0 ? t("video.processing") : t("video.facts", {
														duration: video.durationSeconds.toFixed(1),
														width: String(video.width ?? 0),
														height: String(video.height ?? 0),
														frames: String(video.frameCount ?? 0)
													})
												}),
												video.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: VisionBridgePanel_module_css_default.videoError,
													children: video.error.message
												}),
												video.warnings.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: VisionBridgePanel_module_css_default.videoWarnings,
													children: video.warnings.join(" · ")
												}),
												video.analysis !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
													className: VisionBridgePanel_module_css_default.videoEvidence,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("video.evidence", { count: String(video.analysis.evidence.length) }) }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: video.analysis.prompt }),
														video.analysis.evidence.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", { children: item.timestampsSeconds.map((time) => `${time.toFixed(1)}s`).join(" · ") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: item.description })] }, `${video.videoId}-evidence-${index}`))
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
													className: VisionBridgePanel_module_css_default.entryFooter,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
														dateTime: new Date(video.updatedAt).toISOString(),
														children: new Date(video.updatedAt).toLocaleString()
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: VisionBridgePanel_module_css_default.videoActions,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: VisionBridgePanel_module_css_default.textAction,
															onClick: () => videoController.select(resolvedSessionId, video.videoId),
															children: t("video.useInChat")
														}), [
															"ready",
															"done",
															"partial",
															"failed",
															"cancelled",
															"paused_config"
														].includes(video.status) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: VisionBridgePanel_module_css_default.textAction,
															onClick: () => void videoController.delete(resolvedSessionId, video.videoId).catch(() => {}),
															children: t("video.delete")
														})]
													})]
												})
											]
										})]
									}, video.videoId))
								})
							]
						})]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:src/client/VisionDescribeCard.module.css.mjs
		const css$3 = ".mF-rcG_card{border-left:3px solid var(--dsw-alias-state-business-primary,#4d6bfe);background:var(--dsw-alias-bg-module-platform,#f5f6f7);color:var(--dsw-alias-label-primary,inherit);border-radius:6px;flex-direction:column;gap:4px;padding:8px 12px;display:flex}.mF-rcG_running{border-left-color:var(--dsw-alias-state-warn-primary,#d8a300)}.mF-rcG_failed,.mF-rcG_interrupted{border-left-color:var(--dsw-alias-state-error-primary,#e05252)}.mF-rcG_cardHeader{justify-content:space-between;align-items:center;gap:12px;display:flex}.mF-rcG_running .mF-rcG_label:after{content:\"\";background:currentColor;border-radius:50%;width:6px;height:6px;margin-left:7px;animation:1.1s ease-in-out infinite mF-rcG_vision-pulse;display:inline-block}.mF-rcG_label{opacity:.7;text-transform:uppercase;letter-spacing:.04em;font-size:11px;font-weight:600}.mF-rcG_text{overflow-wrap:anywhere;margin:0;font-size:13px;line-height:1.5}@keyframes mF-rcG_vision-pulse{0%,to{opacity:.25}50%{opacity:1}}";
		const tagId$3 = "dsh-visual-plugin/VisionDescribeCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var VisionDescribeCard_module_css_default = {
			"card": "mF-rcG_card",
			"cardHeader": "mF-rcG_cardHeader",
			"failed": "mF-rcG_failed",
			"interrupted": "mF-rcG_interrupted",
			"label": "mF-rcG_label",
			"running": "mF-rcG_running",
			"text": "mF-rcG_text",
			"vision-pulse": "mF-rcG_vision-pulse"
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
		//#region \0dsh-css:src/client/VisionActivityCards.module.css.mjs
		const css$2 = "._02Vn4q_list{flex-direction:column;gap:8px;width:100%;display:flex}";
		const tagId$2 = "dsh-visual-plugin/VisionActivityCards.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var VisionActivityCards_module_css_default = { "list": "_02Vn4q_list" };
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
		//#region \0dsh-css:src/client/VisionBridgeCard.module.css.mjs
		const css$1 = ".jKXBGG_card{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-2,#fff);border-radius:14px;list-style:none;overflow:hidden}.jKXBGG_cardOpen{border-color:var(--dsw-alias-border-l1,#00000024)}.jKXBGG_header{box-sizing:border-box;width:100%;min-height:56px;color:inherit;cursor:pointer;font:inherit;text-align:left;background:0 0;border:0;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;display:flex}.jKXBGG_header:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000f)}.jKXBGG_headText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.jKXBGG_name{color:var(--dsw-alias-label-primary,#0f1115);font-size:14px;font-weight:600}.jKXBGG_description{color:var(--dsw-alias-label-secondary,#4f5359);font-size:12px;line-height:1.45}.jKXBGG_pending{color:var(--dsw-alias-state-warn-label,#b26720);background:var(--dsw-alias-state-warn-tertiary,#fef5e7);border-radius:999px;flex:none;padding:2px 8px;font-size:11px;font-weight:600}.jKXBGG_chevron{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;width:16px;height:16px;color:var(--dsw-alias-label-tertiary,#777b81);flex:none;transition:transform .12s}.jKXBGG_chevronOpen{transform:rotate(180deg)}.jKXBGG_body{flex-direction:column;gap:14px;padding:4px 16px 16px;display:flex}.jKXBGG_readOnly{color:var(--dsw-alias-label-secondary,#4f5359);margin:0;font-size:12px}.jKXBGG_sidebarRow{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-module-platform,#f5f6f7);border-radius:9px;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}.jKXBGG_capability{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-module-platform,#f5f6f7);border-radius:9px;flex-direction:column;align-items:flex-start;gap:7px;padding:10px 12px;display:flex}.jKXBGG_capabilityHead{justify-content:space-between;align-items:center;gap:10px;width:100%;display:flex}.jKXBGG_sidebarText{flex-direction:column;gap:2px;min-width:0;display:flex}.jKXBGG_sidebarLabel{color:var(--dsw-alias-label-primary,#0f1115);font-size:13px;font-weight:550}.jKXBGG_sidebarHint{color:var(--dsw-alias-label-tertiary,#70747a);margin:0;font-size:11px;line-height:1.5}.jKXBGG_toggle{cursor:pointer;background:0 0;border:0;border-radius:9px;flex:none;padding:0}.jKXBGG_toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}.jKXBGG_toggleTrack{background:var(--dsw-alias-border-l2,#00000029);width:32px;height:18px;transition:background-color .12s var(--ds-ease-in-out,ease);border-radius:9px;display:inline-block;position:relative}.jKXBGG_toggleThumb{background:var(--dsw-alias-bg-layer-1,#fff);width:14px;height:14px;transition:transform .12s var(--ds-ease-in-out,ease);border-radius:50%;position:absolute;top:2px;left:2px}.jKXBGG_toggleTrack[data-on=true]{background:var(--dsw-alias-state-business-primary,#4176e6)}.jKXBGG_toggleTrack[data-on=true] .jKXBGG_toggleThumb{transform:translate(14px)}.jKXBGG_field{flex-direction:column;gap:7px;font-size:12px;display:flex}.jKXBGG_fieldHead{justify-content:space-between;align-items:center;gap:10px;display:flex}.jKXBGG_label{color:var(--dsw-alias-label-secondary,#4f5359);font-weight:550}.jKXBGG_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#00000029);background:var(--dsw-specific-input-major,#fff);width:100%;min-height:40px;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;border-radius:9px;outline:none;padding:9px 11px;transition:border-color .12s,box-shadow .12s}.jKXBGG_input::placeholder{color:var(--dsw-alias-label-caption,#9aa0a6)}.jKXBGG_input:focus{border-color:var(--dsw-alias-state-business-primary,#4176e6);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176e6) 16%, transparent)}.jKXBGG_input:disabled{opacity:.6;cursor:not-allowed}.jKXBGG_inputInvalid{box-sizing:border-box;border:1px solid var(--dsw-alias-state-error-primary,#ec1313);background:var(--dsw-specific-input-major,#fff);width:100%;min-height:40px;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;border-radius:9px;outline:none;padding:9px 11px}.jKXBGG_hint{color:var(--dsw-alias-label-tertiary,#70747a);margin:0;font-size:11px;line-height:1.5}.jKXBGG_invalid{color:var(--dsw-alias-state-error-primary,#ec1313);margin:0;font-size:11px;line-height:1.5}.jKXBGG_badge,.jKXBGG_badgeMuted{border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600}.jKXBGG_badgeError{background:var(--dsw-alias-state-error-tertiary,#feecec);color:var(--dsw-alias-state-error-primary,#c53d3d);border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600}.jKXBGG_badge{color:var(--dsw-alias-state-success-primary,#22a955);background:var(--dsw-alias-state-success-tertiary,#e6faed)}.jKXBGG_badgeMuted{color:var(--dsw-alias-label-tertiary,#70747a);background:var(--dsw-alias-bg-module-platform,#f5f6f7)}.jKXBGG_testRow{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.jKXBGG_testButton,.jKXBGG_refreshButton{cursor:pointer;font:inherit;border-radius:9px;transition:background-color .12s,opacity .12s}.jKXBGG_testButton{border:1px solid var(--dsw-alias-border-l3,#00000029);background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#0f1115);min-height:34px;padding:6px 12px;font-weight:600}.jKXBGG_testButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid,#f1f3f5)}.jKXBGG_testButton:disabled{cursor:not-allowed;opacity:.45}.jKXBGG_refreshButton{color:var(--dsw-alias-label-secondary,#4f5359);background:0 0;border:0;padding:5px 7px;font-size:12px}.jKXBGG_refreshButton:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000f);color:var(--dsw-alias-label-primary,#0f1115)}.jKXBGG_balanceRow{justify-content:space-between;align-items:center;gap:12px;display:flex}.jKXBGG_balanceTitle{color:var(--dsw-alias-label-secondary,#4f5359);font-size:12px;font-weight:600}.jKXBGG_balanceLine,.jKXBGG_note{color:var(--dsw-alias-label-secondary,#4f5359);margin:0;font-size:12px;line-height:1.5}.jKXBGG_ok{color:var(--dsw-alias-state-success-primary,#22a955);font-size:12px}.jKXBGG_error{color:var(--dsw-alias-state-error-primary,#ec1313);font-size:12px}.jKXBGG_footer{justify-content:flex-end;align-items:center;gap:8px;display:flex}.jKXBGG_failed{color:var(--dsw-alias-state-error-primary,#ec1313);margin:0 auto 0 0;font-size:12px}.jKXBGG_discard,.jKXBGG_save{cursor:pointer;font:inherit;border-radius:9px;min-height:36px;padding:8px 14px;font-weight:600;transition:background-color .12s,opacity .12s}.jKXBGG_discard{border:1px solid var(--dsw-alias-border-l3,#00000029);background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#0f1115)}.jKXBGG_discard:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid,#f1f3f5)}.jKXBGG_save{border:1px solid var(--dsw-alias-button-info-fill,#4176e6);background:var(--dsw-alias-button-info-fill,#4176e6);color:var(--dsw-static-neutral-00,#fff)}.jKXBGG_save:hover:not(:disabled){border-color:var(--dsw-alias-button-info-hover,#5686fe);background:var(--dsw-alias-button-info-hover,#5686fe)}.jKXBGG_discard:disabled,.jKXBGG_save:disabled{cursor:not-allowed;opacity:.45}";
		const tagId$1 = "dsh-visual-plugin/VisionBridgeCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var VisionBridgeCard_module_css_default = {
			"badge": "jKXBGG_badge",
			"badgeError": "jKXBGG_badgeError",
			"badgeMuted": "jKXBGG_badgeMuted",
			"balanceLine": "jKXBGG_balanceLine",
			"balanceRow": "jKXBGG_balanceRow",
			"balanceTitle": "jKXBGG_balanceTitle",
			"body": "jKXBGG_body",
			"capability": "jKXBGG_capability",
			"capabilityHead": "jKXBGG_capabilityHead",
			"card": "jKXBGG_card",
			"cardOpen": "jKXBGG_cardOpen",
			"chevron": "jKXBGG_chevron",
			"chevronOpen": "jKXBGG_chevronOpen",
			"description": "jKXBGG_description",
			"discard": "jKXBGG_discard",
			"error": "jKXBGG_error",
			"failed": "jKXBGG_failed",
			"field": "jKXBGG_field",
			"fieldHead": "jKXBGG_fieldHead",
			"footer": "jKXBGG_footer",
			"headText": "jKXBGG_headText",
			"header": "jKXBGG_header",
			"hint": "jKXBGG_hint",
			"input": "jKXBGG_input",
			"inputInvalid": "jKXBGG_inputInvalid",
			"invalid": "jKXBGG_invalid",
			"label": "jKXBGG_label",
			"name": "jKXBGG_name",
			"note": "jKXBGG_note",
			"ok": "jKXBGG_ok",
			"pending": "jKXBGG_pending",
			"readOnly": "jKXBGG_readOnly",
			"refreshButton": "jKXBGG_refreshButton",
			"save": "jKXBGG_save",
			"sidebarHint": "jKXBGG_sidebarHint",
			"sidebarLabel": "jKXBGG_sidebarLabel",
			"sidebarRow": "jKXBGG_sidebarRow",
			"sidebarText": "jKXBGG_sidebarText",
			"testButton": "jKXBGG_testButton",
			"testRow": "jKXBGG_testRow",
			"toggle": "jKXBGG_toggle",
			"toggleThumb": "jKXBGG_toggleThumb",
			"toggleTrack": "jKXBGG_toggleTrack"
		};
		//#endregion
		//#region src/client/VisionBridgeCard.tsx
		/**
		* The vision-bridge settings card: a header naming the plugin and disclosing
		* its endpoint/model/key controls, with the save that writes them. `url` and
		* `model` are settings-section values written through the card's controller;
		* `apiKey` is a write-only credential. The card also hosts the connection test
		* and the balance readout, which are vision-bridge-specific.
		* @module dsh-visual-plugin/client/VisionBridgeCard
		*/
		/**
		* Render one vision-bridge configuration card.
		* @param props - locale copy, the card snapshot, and its form actions.
		* @returns the card, or nothing when the namespace is unavailable.
		*/
		function VisionBridgeCard(props) {
			const { t, useStore, actions } = props;
			const state = props.useVisionBridgeCard((snapshot) => snapshot);
			const sidebarOpen = useStore((s) => s.open);
			const [open, setOpen] = (0, react.useState)(false);
			const [testing, setTesting] = (0, react.useState)(false);
			const [testResult, setTestResult] = (0, react.useState)(null);
			const [balance, setBalance] = (0, react.useState)(null);
			const [videoHealth, setVideoHealth] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!open) return;
				loadBalance();
				loadVideoHealth();
			}, [open]);
			if (!state.available) return null;
			const title = t("settings.title");
			const blocked = !state.dirty || state.invalid || state.saving;
			const canTest = !testing && state.url.trim() !== "" && state.model.trim() !== "";
			/** POST a connection test to the host route, using the staged drafts. */
			async function runTest() {
				setTesting(true);
				setTestResult(null);
				try {
					setTestResult(await (await fetch("/vision-bridge/test", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							url: state.url,
							model: state.model,
							apiKey: state.apiKey
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
			}
			/** Load the configured endpoint's remaining balance. */
			async function loadBalance() {
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
			}
			/** Probe the required local FFmpeg/FFprobe/PySceneDetect toolchain. */
			async function loadVideoHealth() {
				try {
					setVideoHealth(await (await fetch("/vision-bridge/videos/health")).json());
				} catch {
					setVideoHealth({
						available: false,
						issues: [{
							code: "health_unavailable",
							message: "Health check failed."
						}]
					});
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: open ? `${VisionBridgeCard_module_css_default.card} ${VisionBridgeCard_module_css_default.cardOpen}` : VisionBridgeCard_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: VisionBridgeCard_module_css_default.header,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: VisionBridgeCard_module_css_default.headText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: VisionBridgeCard_module_css_default.name,
								children: title
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: VisionBridgeCard_module_css_default.description,
								children: t("settings.description")
							})]
						}),
						state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: VisionBridgeCard_module_css_default.pending,
							children: t("action.unsaved")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							className: open ? `${VisionBridgeCard_module_css_default.chevron} ${VisionBridgeCard_module_css_default.chevronOpen}` : VisionBridgeCard_module_css_default.chevron,
							viewBox: "0 0 16 16",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m4 6 4 4 4-4" })
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: VisionBridgeCard_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: VisionBridgeCard_module_css_default.readOnly,
							role: "status",
							children: t("settings.readOnly")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: VisionBridgeCard_module_css_default.sidebarRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: VisionBridgeCard_module_css_default.sidebarText,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: VisionBridgeCard_module_css_default.sidebarLabel,
									children: t("settings.sidebar")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: VisionBridgeCard_module_css_default.sidebarHint,
									children: t("settings.sidebarHint")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: VisionBridgeCard_module_css_default.toggle,
								role: "switch",
								"aria-checked": sidebarOpen,
								"aria-label": t("settings.sidebar"),
								onClick: actions.toggle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: VisionBridgeCard_module_css_default.toggleTrack,
									"data-on": sidebarOpen || void 0,
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: VisionBridgeCard_module_css_default.toggleThumb })
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: VisionBridgeCard_module_css_default.capability,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: VisionBridgeCard_module_css_default.capabilityHead,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: VisionBridgeCard_module_css_default.sidebarLabel,
									children: t("video.dependencies")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: VisionBridgeCard_module_css_default.refreshButton,
									onClick: () => {
										loadVideoHealth();
									},
									children: t("action.refresh")
								})]
							}), videoHealth === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: VisionBridgeCard_module_css_default.hint,
								children: t("video.dependenciesChecking")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: videoHealth.available ? VisionBridgeCard_module_css_default.badge : VisionBridgeCard_module_css_default.badgeError,
									children: videoHealth.available ? t("video.dependenciesReady") : t("video.dependenciesMissing")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: VisionBridgeCard_module_css_default.hint,
									children: [
										"FFmpeg ",
										videoHealth.ffmpeg?.version ?? "—",
										" · FFprobe ",
										videoHealth.ffprobe?.version ?? "—",
										" · PySceneDetect ",
										videoHealth.sceneDetect?.version ?? "—"
									]
								}),
								videoHealth.issues.map((issue) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: VisionBridgeCard_module_css_default.invalid,
									children: issue.message
								}, issue.code))
							] })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: VisionBridgeCard_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: VisionBridgeCard_module_css_default.label,
									children: t("field.url")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: VisionBridgeCard_module_css_default.input,
									type: "text",
									value: state.url,
									placeholder: t("field.url.placeholder"),
									disabled: !state.writable,
									onChange: (event) => {
										props.edit("url", event.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: VisionBridgeCard_module_css_default.hint,
									children: t("field.url.hint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: VisionBridgeCard_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: VisionBridgeCard_module_css_default.label,
									children: t("field.model")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: VisionBridgeCard_module_css_default.input,
									type: "text",
									value: state.model,
									placeholder: t("field.model.placeholder"),
									disabled: !state.writable,
									onChange: (event) => {
										props.edit("model", event.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: VisionBridgeCard_module_css_default.hint,
									children: t("field.model.hint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: VisionBridgeCard_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: VisionBridgeCard_module_css_default.fieldHead,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: VisionBridgeCard_module_css_default.label,
										children: t("field.apiKey")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: state.apiKeyConfigured ? VisionBridgeCard_module_css_default.badge : VisionBridgeCard_module_css_default.badgeMuted,
										children: state.apiKeyConfigured ? t("status.keyConfigured") : t("status.keyMissing")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: VisionBridgeCard_module_css_default.input,
									type: "password",
									autoComplete: "off",
									value: state.apiKey,
									placeholder: t("field.apiKey.placeholder"),
									disabled: !state.writable,
									onChange: (event) => {
										props.edit("apiKey", event.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: VisionBridgeCard_module_css_default.hint,
									children: t("field.apiKey.hint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: VisionBridgeCard_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: VisionBridgeCard_module_css_default.label,
									children: t("field.historyLimit")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: state.invalid ? VisionBridgeCard_module_css_default.inputInvalid : VisionBridgeCard_module_css_default.input,
									type: "number",
									min: "1",
									value: state.historyLimit,
									disabled: !state.writable,
									onChange: (event) => {
										props.edit("historyLimit", event.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: state.invalid ? VisionBridgeCard_module_css_default.invalid : VisionBridgeCard_module_css_default.hint,
									children: state.invalid ? t("field.historyLimit.invalid") : t("field.historyLimit.hint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: VisionBridgeCard_module_css_default.testRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: VisionBridgeCard_module_css_default.testButton,
								disabled: !canTest,
								onClick: () => {
									runTest();
								},
								children: testing ? t("status.testing") : t("action.test")
							}), testResult !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: testResult.ok ? VisionBridgeCard_module_css_default.ok : VisionBridgeCard_module_css_default.error,
								children: testResult.ok ? t("status.testOk", { latency: String(testResult.latencyMs ?? 0) }) : t("status.testFail", { message: testResult.error?.message ?? "unknown" })
							}) : null]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: VisionBridgeCard_module_css_default.balanceRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: VisionBridgeCard_module_css_default.balanceTitle,
								children: t("balance.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: VisionBridgeCard_module_css_default.refreshButton,
								onClick: () => {
									loadBalance();
								},
								children: t("action.refresh")
							})]
						}),
						balance !== null && !balance.supported ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: VisionBridgeCard_module_css_default.note,
							children: balance.error !== void 0 ? t("balance.unavailable", { message: balance.error.message }) : t("balance.unsupported")
						}) : null,
						balance !== null && balance.supported ? (balance.lines ?? []).map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: VisionBridgeCard_module_css_default.balanceLine,
							children: t("balance.line", {
								currency: line.currency,
								available: String(line.available),
								total: String(line.total)
							})
						}, `${line.currency}-${index}`)) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: VisionBridgeCard_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: VisionBridgeCard_module_css_default.failed,
									role: "status",
									children: t("action.saveFailed")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: VisionBridgeCard_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.discard,
									children: t("action.discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: VisionBridgeCard_module_css_default.save,
									disabled: blocked,
									onClick: props.save,
									children: t(state.saving ? "action.saving" : "action.save")
								})
							]
						})
					]
				}) : null]
			});
		}
		/** Format a history-limit value as its input text (empty = unlimited). */
		function historyLimitText(value) {
			if (value === void 0) return "20";
			if (value === null) return "";
			return String(value);
		}
		/** Section field names this form stages (url/model are free-text). */
		const TEXT_FIELDS = ["url", "model"];
		/**
		* Stages one card's edits and plans the writes a save performs. Blank section
		* drafts clear the field (re-inherit the composition default); a blank apiKey
		* draft writes nothing, which keeps the stored credential; a blank history
		* limit writes `null` (unlimited).
		*/
		var VisionBridgeForm = class {
			staged = /* @__PURE__ */ new Map();
			/** Stage draft text for one field. */
			edit(field, text) {
				this.staged.set(field, text);
			}
			/** Drop every staged edit. */
			discard() {
				this.staged.clear();
			}
			/** Draft text one field renders: the staged edit, else the section value (blank for apiKey). */
			text(field, section) {
				const staged = this.staged.get(field);
				if (staged !== void 0) return staged;
				if (field === "apiKey") return "";
				if (field === "historyLimit") return historyLimitText(section.historyLimit);
				return section[field];
			}
			/** Plan the writes a save would perform, in the order the fields were staged. */
			plan(section) {
				const writes = [];
				let dirty = false;
				let invalid = false;
				for (const field of TEXT_FIELDS) {
					const staged = this.staged.get(field);
					if (staged === void 0) continue;
					const trimmed = staged.trim();
					if (trimmed === section[field]) continue;
					dirty = true;
					if (trimmed === "") writes.push({
						field,
						kind: "clear"
					});
					else writes.push({
						field,
						kind: "set",
						value: trimmed
					});
				}
				const key = this.staged.get("apiKey");
				if (key !== void 0 && key.trim() !== "") {
					dirty = true;
					writes.push({
						field: "apiKey",
						kind: "set",
						value: key.trim()
					});
				}
				const limit = this.staged.get("historyLimit");
				if (limit !== void 0) {
					const trimmed = limit.trim();
					if (trimmed === "") {
						if (section.historyLimit !== null) {
							dirty = true;
							writes.push({
								field: "historyLimit",
								kind: "set",
								value: null
							});
						}
					} else {
						const parsed = Number(trimmed);
						if (Number.isInteger(parsed) && parsed > 0) {
							if (parsed !== section.historyLimit) {
								dirty = true;
								writes.push({
									field: "historyLimit",
									kind: "set",
									value: parsed
								});
							}
						} else {
							dirty = true;
							invalid = true;
						}
					}
				}
				return {
					writes,
					dirty,
					invalid
				};
			}
		};
		//#endregion
		//#region src/client/vision-bridge-card-controller.ts
		/**
		* The vision-bridge settings card's staged form. Unlike the harness's shipped
		* plugin cards, the `vision-bridge` settings namespace is NOT on the settings
		* web gateway's allowlist, so the card cannot bind it through `settingsScope`
		* (it would read `settings-not-exposed` forever). It instead reads and writes
		* the bridge config through the same-origin `/vision-bridge/config` route the
		* Host exposes: `url`/`model`/`historyLimit` are settings-section values,
		* `apiKey` is a write-only credential the Host stores through the credentials
		* seam.
		* @module dsh-visual-plugin/client/vision-bridge-card-controller
		*/
		/** Bridges the same-origin config route onto the card's staged form. */
		var VisionBridgeCardController = class {
			form = new VisionBridgeForm();
			store;
			section = {
				url: "",
				model: ""
			};
			apiKeyConfigured = false;
			available = false;
			saving = false;
			failed = false;
			constructor() {
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.projection());
				this.load();
			}
			projection() {
				const plan = this.form.plan(this.section);
				return {
					available: this.available,
					writable: true,
					dirty: plan.dirty,
					invalid: plan.invalid,
					saving: this.saving,
					failed: this.failed,
					url: this.form.text("url", this.section),
					model: this.form.text("model", this.section),
					apiKey: this.form.text("apiKey", this.section),
					historyLimit: this.form.text("historyLimit", this.section),
					apiKeyConfigured: this.apiKeyConfigured
				};
			}
			/** Load the stored config and key state from the host config route. */
			async load() {
				try {
					const body = await (await fetch("/vision-bridge/config")).json();
					if (body.ok !== true || body.config === void 0) return;
					this.section = {
						url: body.config.url ?? "",
						model: body.config.model ?? "",
						historyLimit: body.config.historyLimit
					};
					this.apiKeyConfigured = body.config.keyConfigured ?? false;
					this.available = true;
					this.publish();
				} catch {}
			}
			/** Build the card's face for the slot registration. */
			inject() {
				return {
					hooks: { visionBridgeCard: this.store },
					edit: (field, text) => {
						this.form.edit(field, text);
						this.failed = false;
						this.publish();
					},
					discard: () => {
						this.form.discard();
						this.failed = false;
						this.publish();
					},
					save: () => {
						this.save();
					}
				};
			}
			/**
			* Write every staged edit through the host config route, then re-seed from
			* what the Host accepted. A save that did not land keeps its drafts so the
			* user can correct them.
			*/
			async save() {
				const plan = this.form.plan(this.section);
				if (!plan.dirty || plan.invalid || this.saving) return;
				this.saving = true;
				this.failed = false;
				this.publish();
				const url = this.form.text("url", this.section);
				const model = this.form.text("model", this.section);
				const apiKey = this.form.text("apiKey", this.section);
				const limitText = this.form.text("historyLimit", this.section).trim();
				const historyLimit = limitText === "" ? null : Number(limitText);
				try {
					const body = await (await fetch("/vision-bridge/config", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							url,
							model,
							apiKey,
							historyLimit
						})
					})).json();
					if (body.ok === true) {
						this.form.discard();
						this.section = {
							url,
							model,
							historyLimit
						};
						this.apiKeyConfigured = body.config?.keyConfigured ?? this.apiKeyConfigured;
					} else this.failed = true;
				} catch {
					this.failed = true;
				}
				this.saving = false;
				this.publish();
			}
			publish() {
				this.store.set(this.projection());
			}
		};
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
		* between the settings card's sidebar toggle and the overlay entry. The open
		* state persists to localStorage so a browser refresh keeps the panel visible
		* when the user left it open.
		* @module dsh-visual-plugin/client/store
		*/
		/** localStorage key under which the sidebar open state persists. */
		const SIDEBAR_STORAGE_KEY = "dsh-visual-plugin:sidebar-open";
		/** Read the persisted open state, defaulting to closed when unavailable. */
		function readInitialOpen() {
			try {
				return typeof localStorage !== "undefined" && localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
			} catch {
				return false;
			}
		}
		/** Persist the open state across refreshes. */
		function persistOpen(open) {
			try {
				if (typeof localStorage === "undefined") return;
				localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? "1" : "0");
			} catch {}
		}
		/**
		* Create the panel store handle.
		* @returns the live store handle bound by the registering entries.
		*/
		function createVisionBridgeStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({ open: readInitialOpen() }),
				actions: {
					toggle: (d) => {
						d.open = !d.open;
						persistOpen(d.open);
					},
					close: (d) => {
						d.open = false;
						persistOpen(false);
					}
				}
			});
		}
		//#endregion
		//#region src/client/video-client-controller.ts
		const EMPTY_STATE = {
			videos: [],
			phase: "idle",
			progress: 0
		};
		async function responseError(response) {
			const body = await response.json().catch(() => ({}));
			return new Error(body.error?.message ?? `Video request failed (${response.status})`);
		}
		function uploadBytes(url, file, onProgress) {
			return new Promise((resolve, reject) => {
				const request = new XMLHttpRequest();
				request.open("PUT", url);
				request.setRequestHeader("Content-Type", "application/octet-stream");
				request.upload.onprogress = (event) => {
					if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
				};
				request.onerror = () => reject(/* @__PURE__ */ new Error("Video upload connection failed."));
				request.onabort = () => reject(new DOMException("Video upload was cancelled.", "AbortError"));
				request.onload = () => {
					let body = {};
					try {
						body = JSON.parse(request.responseText);
					} catch {}
					if (request.status >= 200 && request.status < 300 && body.video !== void 0) resolve(body.video);
					else reject(new Error(body.error?.message ?? `Video upload failed (${request.status})`));
				};
				request.send(file);
			});
		}
		/** Shared client module used by the input slots and the right-side panel. */
		var VideoClientController = class {
			states = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Map();
			snapshot(sessionId) {
				return this.states.get(sessionId) ?? EMPTY_STATE;
			}
			subscribe(sessionId, listener) {
				const listeners = this.listeners.get(sessionId) ?? /* @__PURE__ */ new Set();
				listeners.add(listener);
				this.listeners.set(sessionId, listeners);
				return () => {
					listeners.delete(listener);
					if (listeners.size === 0) this.listeners.delete(sessionId);
				};
			}
			async refresh(sessionId) {
				if (sessionId.length === 0) return;
				try {
					const response = await fetch(`/vision-bridge/videos?sessionId=${encodeURIComponent(sessionId)}`);
					if (!response.ok) throw await responseError(response);
					const body = await response.json();
					this.update(sessionId, {
						videos: body.videos ?? [],
						error: void 0
					});
				} catch (error) {
					this.update(sessionId, { error: error instanceof Error ? error.message : String(error) });
				}
			}
			async upload(sessionId, file) {
				this.update(sessionId, {
					phase: "uploading",
					progress: 0,
					activeFileName: file.name,
					error: void 0
				});
				try {
					const response = await fetch("/vision-bridge/videos", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							sessionId,
							fileName: file.name,
							mediaType: file.type || "application/octet-stream",
							declaredSize: file.size
						})
					});
					if (!response.ok) throw await responseError(response);
					const body = await response.json();
					if (body.video === void 0) throw new Error("Video upload intent was not created.");
					const video = await uploadBytes(`/vision-bridge/videos/${encodeURIComponent(body.video.videoId)}/upload?sessionId=${encodeURIComponent(sessionId)}`, file, (progress) => {
						this.update(sessionId, {
							phase: progress >= 1 ? "processing" : "uploading",
							progress
						});
					});
					this.update(sessionId, {
						videos: [video, ...this.snapshot(sessionId).videos.filter((item) => item.videoId !== video.videoId)],
						phase: "idle",
						progress: 1,
						activeFileName: void 0
					});
				} catch (error) {
					this.update(sessionId, {
						phase: "idle",
						progress: 0,
						activeFileName: void 0,
						error: error instanceof Error ? error.message : String(error)
					});
					throw error;
				}
			}
			async delete(sessionId, videoId) {
				try {
					const response = await fetch(`/vision-bridge/videos/${encodeURIComponent(videoId)}?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
					if (!response.ok) throw await responseError(response);
					this.update(sessionId, {
						videos: this.snapshot(sessionId).videos.filter((video) => video.videoId !== videoId),
						error: void 0
					});
				} catch (error) {
					this.update(sessionId, { error: error instanceof Error ? error.message : String(error) });
					throw error;
				}
			}
			select(sessionId, videoId) {
				this.update(sessionId, {
					selection: {
						token: Date.now() + Math.random(),
						videoId
					},
					error: void 0
				});
			}
			update(sessionId, patch) {
				this.states.set(sessionId, {
					...this.snapshot(sessionId),
					...patch
				});
				for (const listener of this.listeners.get(sessionId) ?? []) listener();
			}
		};
		//#endregion
		//#region \0dsh-css:src/client/VideoUploadButton.module.css.mjs
		const css = ".iUyyUa_hiddenInput{display:none}.iUyyUa_uploadButton{width:32px;height:32px;color:var(--dsw-alias-label-secondary,#52565c);cursor:pointer;background:0 0;border:0;border-radius:9px;place-items:center;padding:0;display:grid}.iUyyUa_uploadButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#0000000f);color:var(--dsw-alias-label-primary,#111318)}.iUyyUa_uploadButton:disabled{opacity:.45;cursor:not-allowed}.iUyyUa_uploadButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}.iUyyUa_uploadButton svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;width:20px;height:20px}.iUyyUa_dock{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-2,#fff);width:100%;color:var(--dsw-alias-label-secondary,#52565c);border-radius:10px;padding:9px 12px;font-size:12px}.iUyyUa_dockError{border-color:var(--dsw-alias-state-error-primary,#d64b4b);color:var(--dsw-alias-state-error-primary,#b93838)}.iUyyUa_dockTopline{justify-content:space-between;align-items:center;gap:12px;min-width:0;display:flex}.iUyyUa_fileName{min-width:0;color:var(--dsw-alias-label-tertiary,#777b81);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.iUyyUa_progressTrack{background:var(--dsw-alias-border-l2,#0000001a);border-radius:999px;height:3px;margin-top:8px;overflow:hidden}.iUyyUa_progressTrack span{border-radius:inherit;background:var(--dsw-alias-state-business-primary,#4176e6);height:100%;transition:width .12s;display:block}";
		const tagId = "dsh-visual-plugin/VideoUploadButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-visual-plugin";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var VideoUploadButton_module_css_default = {
			"dock": "iUyyUa_dock",
			"dockError": "iUyyUa_dockError",
			"dockTopline": "iUyyUa_dockTopline",
			"fileName": "iUyyUa_fileName",
			"hiddenInput": "iUyyUa_hiddenInput",
			"progressTrack": "iUyyUa_progressTrack",
			"uploadButton": "iUyyUa_uploadButton"
		};
		//#endregion
		//#region src/client/VideoUploadButton.tsx
		const VIDEO_ACCEPT = ".mp4,.m4v,.mov,.avi,.mpg,.mpeg,.mkv,.webm,video/mp4,video/quicktime,video/x-msvideo,video/mpeg,video/webm";
		function useVideoState(controller, sessionId) {
			return (0, react.useSyncExternalStore)((listener) => controller.subscribe(sessionId, listener), () => controller.snapshot(sessionId), () => controller.snapshot(sessionId));
		}
		/** Plugin-owned video file picker inside the conversation tool row. */
		function VideoUploadButton(props) {
			const sessionId = String(props.sessionId);
			const input = (0, react.useRef)(null);
			const busy = useVideoState(props.videoController, sessionId).phase !== "idle";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				ref: input,
				className: VideoUploadButton_module_css_default.hiddenInput,
				type: "file",
				accept: VIDEO_ACCEPT,
				disabled: busy,
				onChange: (event) => {
					const file = event.currentTarget.files?.[0];
					event.currentTarget.value = "";
					if (file !== void 0) props.videoController.upload(sessionId, file).catch(() => {});
				}
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: VideoUploadButton_module_css_default.uploadButton,
				disabled: busy,
				"aria-label": props.t("video.upload"),
				title: props.t("video.upload"),
				onClick: () => input.current?.click(),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 24 24",
					"aria-hidden": "true",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M15.5 8.5 9.7 4.9A1.1 1.1 0 0 0 8 5.8v7.4a1.1 1.1 0 0 0 1.7.9l5.8-3.6a1.2 1.2 0 0 0 0-2Z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 3.5h14A1.5 1.5 0 0 1 20.5 5v14A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" })]
				})
			})] });
		}
		/** Full-width progress/error row shown only while an upload needs attention. */
		function VideoUploadDock(props) {
			const sessionId = String(props.sessionId);
			const state = useVideoState(props.videoController, sessionId);
			const appliedSelection = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				const selection = state.selection;
				if (selection === void 0 || appliedSelection.current === selection.token) return;
				const video = state.videos.find((item) => item.videoId === selection.videoId);
				if (video === void 0) return;
				appliedSelection.current = selection.token;
				props.inputActions.setDraft(`[视频] ${video.fileName}\n[视频ID] ${video.videoId}\n请描述这个视频中发生了什么？`);
			}, [
				props.inputActions,
				state.selection,
				state.videos
			]);
			if (state.phase === "idle" && state.error === void 0) return null;
			const percentage = Math.round(state.progress * 100);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: state.error === void 0 ? VideoUploadButton_module_css_default.dock : `${VideoUploadButton_module_css_default.dock} ${VideoUploadButton_module_css_default.dockError}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: VideoUploadButton_module_css_default.dockTopline,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: state.error ?? (state.phase === "processing" ? props.t("video.processing") : props.t("video.uploading", { progress: String(percentage) })) }), state.activeFileName !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: VideoUploadButton_module_css_default.fileName,
						children: state.activeFileName
					})]
				}), state.error === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: VideoUploadButton_module_css_default.progressTrack,
					"aria-label": props.t("video.uploadProgress"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { width: `${percentage}%` } })
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** `vision-bridge` namespace dictionaries (the vision bridge panel's copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"panel.title": "视觉桥接",
			"panel.shortHint": "查看已描述的图片和视频",
			"media.select": "选择媒体类型",
			"media.imagesHint": "描述历史",
			"media.videosHint": "上传与播放",
			"settings.title": "视觉桥接",
			"settings.description": "配置视觉模型接口，让纯文本模型理解图片和视频关键帧。",
			"settings.readOnly": "当前设置只读，无法修改。",
			"settings.sidebar": "侧边栏",
			"settings.sidebarHint": "在侧边栏显示图片和视频面板。",
			"field.url": "接口地址",
			"field.url.placeholder": "https://api.deepseek.com",
			"field.url.hint": "OpenAI 兼容的 chat completions 接口地址。",
			"field.model": "模型名称",
			"field.model.placeholder": "glm-4v-flash",
			"field.model.hint": "该接口提供的视觉模型名称。",
			"field.apiKey": "API Key",
			"field.apiKey.placeholder": "仅填写一次，保存后不再回显",
			"field.apiKey.hint": "凭据安全保存、只写不回显；留空则保持现有 Key。",
			"field.historyLimit": "历史描述上限",
			"field.historyLimit.hint": "每张图保留的描述条数；留空表示不限制。",
			"field.historyLimit.invalid": "请输入正整数，或留空表示不限制。",
			"action.save": "保存",
			"action.discard": "丢弃",
			"action.saving": "保存中…",
			"action.saveFailed": "保存失败，请重试",
			"action.unsaved": "未保存",
			"action.test": "测试连接",
			"action.refresh": "刷新",
			"action.close": "关闭视觉桥接面板",
			"action.resize": "拖拽调整面板宽度",
			"action.copy": "复制",
			"action.copyDescription": "复制描述",
			"status.testing": "测试中…",
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
			"history.attachments": "附件 {id}",
			"video.title": "视频",
			"video.latestHint": "插件自有上传、转码和播放；最近更新的视频排在最上方。",
			"video.upload": "上传视频",
			"video.uploading": "视频上传中 {progress}%",
			"video.uploadProgress": "视频上传进度",
			"video.processing": "正在校验、转码并提取场景…",
			"video.emptyTitle": "还没有视频",
			"video.empty": "点击输入框旁的视频按钮，上传 MP4、MOV、AVI、MPG、MKV 或 WebM 视频。",
			"video.status": "状态：{status}",
			"video.facts": "{duration} 秒 · {width}×{height} · {frames} 帧",
			"video.delete": "删除",
			"video.useInChat": "在会话中提问",
			"video.dependencies": "视频解析依赖",
			"video.dependenciesChecking": "正在检查本机依赖…",
			"video.dependenciesReady": "依赖可用",
			"video.dependenciesMissing": "依赖不可用",
			"video.evidence": "关键帧证据（{count} 批）"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"panel.title": "Vision Bridge",
			"panel.shortHint": "Browse described images and videos",
			"media.select": "Select media type",
			"media.imagesHint": "Description history",
			"media.videosHint": "Upload and playback",
			"settings.title": "Vision Bridge",
			"settings.description": "Configure the vision endpoint that lets text-only models understand images and video keyframes.",
			"settings.readOnly": "These settings are read-only.",
			"settings.sidebar": "Sidebar",
			"settings.sidebarHint": "Show the image and video panel in the sidebar.",
			"field.url": "Endpoint URL",
			"field.url.placeholder": "https://api.deepseek.com",
			"field.url.hint": "Base URL of the OpenAI-compatible chat completions API.",
			"field.model": "Model name",
			"field.model.placeholder": "glm-4v-flash",
			"field.model.hint": "Vision-capable model name served by that endpoint.",
			"field.apiKey": "API Key",
			"field.apiKey.placeholder": "Enter once; never echoed after saving",
			"field.apiKey.hint": "Stored securely, write-only. Leave blank to keep the current key.",
			"field.historyLimit": "History limit",
			"field.historyLimit.hint": "Description entries kept per image; leave empty for unlimited.",
			"field.historyLimit.invalid": "Enter a positive integer, or leave empty for unlimited.",
			"action.save": "Save",
			"action.discard": "Discard",
			"action.saving": "Saving…",
			"action.saveFailed": "Save failed, please retry",
			"action.unsaved": "Unsaved",
			"action.test": "Test connection",
			"action.refresh": "Refresh",
			"action.close": "Close Vision Bridge panel",
			"action.resize": "Drag to resize the panel",
			"action.copy": "Copy",
			"action.copyDescription": "Copy description",
			"status.testing": "Testing…",
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
			"history.attachments": "Attachment {id}",
			"video.title": "Videos",
			"video.latestHint": "Plugin-owned upload, transcoding, and playback; recently updated videos appear first.",
			"video.upload": "Upload video",
			"video.uploading": "Uploading video {progress}%",
			"video.uploadProgress": "Video upload progress",
			"video.processing": "Validating, transcoding, and extracting scenes…",
			"video.emptyTitle": "No videos yet",
			"video.empty": "Use the video button beside the composer to upload MP4, MOV, AVI, MPG, MKV, or WebM video.",
			"video.status": "Status: {status}",
			"video.facts": "{duration}s · {width}×{height} · {frames} frames",
			"video.delete": "Delete",
			"video.useInChat": "Ask in chat",
			"video.dependencies": "Video dependencies",
			"video.dependenciesChecking": "Checking local dependencies…",
			"video.dependenciesReady": "Dependencies ready",
			"video.dependenciesMissing": "Dependencies unavailable",
			"video.evidence": "Keyframe evidence ({count} batches)"
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
		* Client plugin body: register the floating panel, its sidebar toggle, the
		* `vision_describe` tool card, and the settings configuration card.
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
			const videoController = new VideoClientController();
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "vision-bridge-panel",
				order: 100,
				locale: NS,
				store: visionBridgeStore,
				inject: () => ({
					api,
					videoController
				})
			}, VisionBridgePanel));
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "vision-bridge-video-upload",
				order: 100,
				locale: NS,
				inject: () => ({ videoController })
			}, VideoUploadButton));
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "vision-bridge-video-progress",
				order: 30,
				locale: NS,
				inject: () => ({ videoController })
			}, VideoUploadDock));
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
			const visionBridgeCard = new VisionBridgeCardController();
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				locale: NS,
				store: visionBridgeStore,
				inject: () => visionBridgeCard.inject(),
				key: "vision-bridge",
				id: "vision-bridge",
				order: 30
			}, VisionBridgeCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map