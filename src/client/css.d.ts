/** Ambient declaration for CSS Modules compiled by the tsdown virtual plugin. */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
