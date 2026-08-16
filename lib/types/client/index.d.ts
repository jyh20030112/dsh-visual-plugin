/**
 * Vision bridge web surface, client half. Registers the floating panel
 * (`shell.overlay`), the `vision_describe` tool card (`tool.call.toolview`),
 * and the plugin's configuration card in the harness settings surface
 * (`settings.plugin.item`, which also owns the sidebar visibility toggle). The
 * host half (`../index.ts`) owns image interception, the tool, and the HTTP
 * routes.
 * @module dsh-visual-plugin/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type VisionBridgeKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The vision bridge panel and tool card copy. */
        'vision-bridge': VisionBridgeKey;
    }
}
/** Required services: the slot registry, connection RPC, and locale registry. */
export declare const inject: string[];
/**
 * Client plugin body: register the floating panel, its sidebar toggle, the
 * `vision_describe` tool card, and the settings configuration card.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
