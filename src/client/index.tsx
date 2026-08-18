/**
 * Vision bridge web surface, client half. Registers the floating panel
 * (`shell.overlay`), the `vision_describe` tool card (`tool.call.toolview`),
 * and the plugin's configuration card in the harness settings surface
 * (`settings.plugin.item`, which also owns the sidebar visibility toggle). The
 * host half (`../index.ts`) owns image interception, the tool, and the HTTP
 * routes.
 * @module dsh-visual-plugin/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { IApiClient } from '@deepseek-ai/dsh-host-apiproxy/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { VisionBridgePanel, type VisionBridgePanelInjected } from './VisionBridgePanel.tsx'
import { VisionDescribeCard } from './VisionDescribeCard.tsx'
import { InlineVisionDescriptions } from './VisionActivityCards.tsx'
import { VisionBridgeCard } from './VisionBridgeCard.tsx'
import { VisionBridgeCardController } from './vision-bridge-card-controller.ts'
import { visionActivityDefinition } from './vision-activity-definition.ts'
import { createVisionBridgeStore } from './store.ts'
import { en, zh, type VisionBridgeKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The vision bridge panel and tool card copy. */
    'vision-bridge': VisionBridgeKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'vision-bridge'

/** Required services: the slot registry, connection RPC, and locale registry. */
export const inject = ['slots', 'connection', 'locale', 'conversationEvents']

/**
 * Client plugin body: register the floating panel, its sidebar toggle, the
 * `vision_describe` tool card, and the settings configuration card.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-visual-plugin: dictionaries')
  ctx.conversationEvents.register(visionActivityDefinition)

  const connection = ctx.get('connection') as ConnectionHandle | undefined
  const api: IApiClient | undefined = connection?.api

  // ONE shared store handle: the toggle and the panel must observe the same
  // open/closed state. Passing the factory would give each entry its own
  // exclusive instance, so the toggle would flip a copy the panel never sees.
  const visionBridgeStore = createVisionBridgeStore()

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'vision-bridge-panel',
    order: 100,
    locale: NS,
    store: visionBridgeStore,
    inject: (): VisionBridgePanelInjected => ({ api }),
  }, VisionBridgePanel))

  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'vision_describe',
    locale: NS,
  }, VisionDescribeCard))

  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'vision-activity',
    locale: NS,
    inject: () => ({}),
  }, InlineVisionDescriptions))

  // The plugin configuration card inside Settings → Plugins. The `vision-bridge`
  // namespace is not on the settings web gateway's allowlist, so the card reads
  // and writes the config through the host's same-origin `/vision-bridge/config`
  // route instead of the settings scope.
  const visionBridgeCard = new VisionBridgeCardController()
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'vision-bridge',
    locale: NS,
    store: visionBridgeStore,
    inject: () => visionBridgeCard.inject(),
  }, VisionBridgeCard))
}
