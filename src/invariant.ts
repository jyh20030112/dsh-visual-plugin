/**
 * Package-owned invariant companion for `dsh-visual-plugin`.
 * @module dsh-visual-plugin/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-visual-plugin'

/** Cordis companion plugin name. */
export const name = 'dsh-visual-plugin-invariant'

/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the bridge's image interception is a pre-step
 * rewrite whose entered messages are the session log's authoritative record;
 * the tool and HTTP routes share that one source of truth.
 */
const install = (): void => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
