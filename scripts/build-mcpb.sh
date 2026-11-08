#!/usr/bin/env bash
# Build Smithery / Claude Desktop MCPB bundle for mcp-server-droptocdn.
#
# Usage (from integrations/mcp):
#   npm run pack:mcpb
#
# Output: dist/mcp-server-droptocdn.mcpb

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGING="$ROOT/.mcpb-build"
OUTPUT="$ROOT/dist/mcp-server-droptocdn.mcpb"
VERSION="$(node -p "require('$ROOT/package.json').version")"

echo "Building MCPB for mcp-server-droptocdn@${VERSION}..."

rm -rf "$STAGING"
mkdir -p "$STAGING" "$ROOT/dist"

node - "$ROOT/mcpb/manifest.json" "$STAGING/manifest.json" "$VERSION" <<'NODE'
const fs = require('fs');
const [, , src, dest, version] = process.argv;
const manifest = JSON.parse(fs.readFileSync(src, 'utf8'));
manifest.version = version;
manifest.server.mcp_config.args = ['-y', `mcp-server-droptocdn@${version}`];
fs.writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n');
NODE

cp "$ROOT/public-repo/assets/logo.png" "$STAGING/icon.png"

npx --yes @anthropic-ai/mcpb@latest validate "$STAGING/manifest.json"
npx --yes @anthropic-ai/mcpb@latest pack "$STAGING" "$OUTPUT"

echo "Done: $OUTPUT"
