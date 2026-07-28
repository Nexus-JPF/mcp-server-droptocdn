# @droptocdn/mcp-server

[MCP](https://modelcontextprotocol.io) server for [Drop to CDN](https://droptocdn.com) — upload files and get instant public CDN URLs from Claude Desktop, Cursor, and other MCP hosts.

## Install

Add to `.cursor/mcp.json`, `~/.cursor/mcp.json`, or Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "droptocdn": {
      "command": "npx",
      "args": ["-y", "@droptocdn/mcp-server"],
      "env": {
        "DROPTOCDN_API_KEY": "dtc_YOUR_API_KEY"
      }
    }
  }
}
```

Create an API key at [Drop to CDN → Settings → API keys](https://droptocdn.com/dashboard/settings) (`dtc_...`).

## Tools

| Tool | Description |
|------|-------------|
| **upload_file** | Upload a local file or base64 content → public CDN URL |
| **get_file** | Get CDN URL and metadata by file ID |
| **list_files** | List files in your account (paginated) |
| **delete_file** | Permanently delete a file by ID |

Auth: `Authorization: Bearer dtc_...` (validated via `GET /v1/profile`).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DROPTOCDN_API_KEY` | Yes | Your API key (`dtc_...`) |
| `DROPTOCDN_API_URL` | No | API base URL (default `https://api.droptocdn.com/v1`) |

## Example prompts

- "Upload `~/Downloads/report.pdf` to CDN and give me the public URL"
- "List my recent Drop to CDN uploads"
- "Delete file abc123 from my CDN account"

## Development

```bash
npm install
npm run build
DROPTOCDN_API_KEY=dtc_... node dist/index.js
```

## Source

Developed by [Drop to CDN](https://droptocdn.com). This public repo is synced from the private monorepo for npm provenance publishing.

## License

MIT
