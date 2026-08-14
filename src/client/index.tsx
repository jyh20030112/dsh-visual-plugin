/**
 * Vision bridge web surface, client half. Registers the floating panel
 * (`shell.overlay`), its sidebar toggle (`sidebar.footer.action`), and the
 * `vision_describe` tool card (`tool.call.toolview`), all sharing one
 * open/closed store seat. The host half (`../index.ts`) owns image
 * interception, the tool, and the HTTP routes.
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
import { VisionBridgePanel, type VisionBridgePanelInjected } from './VisionBridgePanel.tsx'
import { VisionBridgeToggle } from './VisionBridgeToggle.tsx'
import { VisionDescribeCard } from './VisionDescribeCard.tsx'
import { InlineVisionDescriptions } from './VisionActivityCards.tsx'
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
 * Client plugin body: register the floating panel, its sidebar toggle, and
 * the `vision_describe` tool card.
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

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'vision-bridge-toggle',
    locale: NS,
    store: visionBridgeStore,
    inject: () => ({}),
  }, VisionBridgeToggle))

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
}
