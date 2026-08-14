//#region src/invariant.ts
const PACKAGE_NAME = "dsh-visual-plugin";
/** Cordis companion plugin name. */
const name = "dsh-visual-plugin-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: the bridge's image interception is a pre-step
* rewrite whose entered messages are the session log's authoritative record;
* the tool and HTTP routes share that one source of truth.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
