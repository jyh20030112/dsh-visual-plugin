/**
 * Vision bridge web surface, client half. Registers the floating panel
 * (`shell.overlay`), its sidebar toggle (`sidebar.footer.action`), and the
 * `vision.describe` tool card (`tool.call.toolview`), all sharing one
 * open/closed store seat. The host half (`../index.ts`) owns image
 * interception, the tool, and the HTTP routes.
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
 * Client plugin body: register the floating panel, its sidebar toggle, and
 * the `vision.describe` tool card.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
