#!/usr/bin/env bash
# Bootstrap node_modules for dsh-visual-plugin WITHOUT pnpm.
#
# The plugin targets the CURRENT harness API (0.1.0-rc.5), but the npm-published
# @deepseek-ai/* packages are still 0.0.1-rc.1 (older API). Building against the
# published versions would produce an incompatible bundle, so this script links
# the plugin's node_modules to a local deepseek-harness checkout whose packages
# are already installed and built (lib/ present).
#
# Layout expected:
#   <somewhere>/deepseek_workspace/dsh-visual-plugin   (this project)
#   <somewhere>/deepseek-harness                      (the harness checkout)
# Adjust HARNESS below if your layout differs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HARNESS="${HARNESS:-$(cd "$ROOT/../../deepseek-harness" && pwd)}"

NM="$ROOT/node_modules"
rm -rf "$NM"
mkdir -p "$NM/@deepseek-ai" "$NM/@types"

link() { # link <name> <target>
  local name="$1" target="$2"
  ln -s "$target" "$NM/$name"
}

# --- @deepseek-ai/* workspace packages -------------------------------------
link "@deepseek-ai/cordis"            "$HARNESS/vendor/cordis"
link "@deepseek-ai/schemastery"       "$HARNESS/vendor/schemastery"
link "@deepseek-ai/dsh-tools"         "$HARNESS/packages/core/tools"
link "@deepseek-ai/dsh-settings"      "$HARNESS/packages/settings/settings"
link "@deepseek-ai/dsh-credentials"   "$HARNESS/packages/credentials/credentials"
link "@deepseek-ai/dsh-attachment"    "$HARNESS/packages/attachment/attachment"
link "@deepseek-ai/dsh-host-webserver" "$HARNESS/packages/host/webserver"
link "@deepseek-ai/dsh-llm"           "$HARNESS/packages/llm/llm"
link "@deepseek-ai/dsh-system-prompt" "$HARNESS/packages/core/system-prompt"
link "@deepseek-ai/dsh-invariants"    "$HARNESS/packages/runtime-diagnostics/invariants"
link "@deepseek-ai/dsh-agent"         "$HARNESS/packages/core/agent"
link "@deepseek-ai/dsh-session"       "$HARNESS/packages/core/session"
link "@deepseek-ai/dsh-client-runtime" "$HARNESS/packages/client/runtime"
link "@deepseek-ai/dsh-client-locale"  "$HARNESS/packages/client/locale"
link "@deepseek-ai/dsh-client-connection" "$HARNESS/packages/client/connection"
link "@deepseek-ai/dsh-client-ui-layout"  "$HARNESS/packages/client/ui-layout"
link "@deepseek-ai/dsh-client-ui-sidebar" "$HARNESS/packages/client/ui-sidebar"
link "@deepseek-ai/dsh-client-ui-slots" "$HARNESS/packages/client/ui-slots"
link "@deepseek-ai/dsh-client-ui-tool"  "$HARNESS/packages/client/ui-tool"
link "@deepseek-ai/dsh-client-ui-conversation" "$HARNESS/packages/client/ui-conversation"
link "@deepseek-ai/dsh-host-apiproxy"   "$HARNESS/packages/host/apiproxy"
link "@deepseek-ai/dsh-api-remotes"     "$HARNESS/packages/api/remotes"

# --- build tooling from the harness root node_modules -----------------------
for pkg in typescript tsdown lightningcss; do
  if [ -e "$HARNESS/node_modules/$pkg/package.json" ]; then
    link "$pkg" "$HARNESS/node_modules/$pkg"
  else
    echo "warning: $pkg not found at $HARNESS/node_modules/$pkg" >&2
  fi
done

# --- type packages ----------------------------------------------------------
link "@types/node" "$HARNESS/node_modules/@types/node"
if [ -e "$HARNESS/node_modules/.pnpm/@types+react@18.3.31/node_modules/@types/react" ]; then
  link "@types/react" "$HARNESS/node_modules/.pnpm/@types+react@18.3.31/node_modules/@types/react"
  link "@types/react-dom" "$HARNESS/node_modules/.pnpm/@types+react-dom@18.3.7_@types+react@18.3.31/node_modules/@types/react-dom"
else
  echo "warning: @types/react not found under harness .pnpm; client typecheck may fail" >&2
fi

echo "bootstrapped node_modules -> $HARNESS"
