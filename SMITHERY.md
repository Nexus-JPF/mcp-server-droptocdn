# Smithery publishing

List **mcp-server-droptocdn** on [Smithery](https://smithery.ai) for distribution, install UI, and analytics.

This is separate from the [Official MCP Registry](https://registry.modelcontextprotocol.io/) (see [`PUBLISH.md`](./PUBLISH.md)).

Our server is **local stdio** (`npx mcp-server-droptocdn`), so Smithery uses the **[MCPB bundle](https://smithery.ai/docs/build/publish)** path — not the URL / Streamable HTTP path.

---

## Release checklist

Run after each npm release (keep MCPB `npx` pin in sync with `package.json` version — `build-mcpb.sh` does this automatically).

### 1. Build the MCPB bundle

```bash
cd integrations/mcp
npm run pack:mcpb
```

Output: `dist/mcp-server-droptocdn.mcpb`

Source files:

| File | Purpose |
|------|---------|
| `mcpb/manifest.json` | MCPB template (version + npx pin injected at build) |
| `public-repo/assets/logo.png` | Bundle icon |
| `scripts/build-mcpb.sh` | Staging + `mcpb pack` |

### 2. Publish to Smithery

The web form at [smithery.ai/servers/new](https://smithery.ai/servers/new) is **URL-only** (Streamable HTTP). For stdio MCPB bundles, use the **CLI**:

```bash
npm install -g smithery@latest

# One-time: log in to Smithery
smithery auth login

# Optional: confirm namespace exists
smithery namespace list

# Publish the bundle under your droptocdn namespace
cd integrations/mcp
smithery mcp publish ./dist/mcp-server-droptocdn.mcpb -n droptocdn/mcp-server
```

Replace `droptocdn/mcp-server` with your preferred server slug (3–59 chars, letters/numbers/hyphens/underscores, must start with a letter).

During publish, Smithery may scan the server to extract tools. You'll be prompted for a **Drop to CDN API key** (`dtc_...`) so the scan can connect.

### 3. Verify

Search on [smithery.ai](https://smithery.ai) for "Drop to CDN" or your namespace.

---

## Architecture

```
mcpb/manifest.json          ← user_config for DROPTOCDN_API_KEY
        ↓ npm run pack:mcpb
dist/mcp-server-droptocdn.mcpb   ← manifest + icon; runs npx mcp-server-droptocdn@VERSION
        ↓ smithery mcp publish
smithery.ai                 ← install UI + analytics
```

The bundle does **not** embed server code — it uses `npx` to pull the published npm package. Bump and republish the MCPB on Smithery whenever you release a new npm version.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Scan fails / auth error | Provide a valid `dtc_...` API key during Smithery onboarding |
| CLI 400 `expected object, received undefined` (×N tools) | Remove `tools` from `mcpb/manifest.json` — MCPB forbids `inputSchema`, Smithery requires it ([smithery-ai/cli#787](https://github.com/smithery-ai/cli/issues/787)). Smithery scans tools at publish time instead. |
| CLI 400 `No values to set` | Upgrade `smithery` CLI; or add `"tools": []` to manifest |
| Wrong npm version installed | Re-run `npm run pack:mcpb` after bumping `package.json` |

---

## Related

- [MCPB spec](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md)
- [Smithery publish docs](https://smithery.ai/docs/build/publish)
- [`PUBLISH.md`](./PUBLISH.md) — npm + Official MCP Registry
