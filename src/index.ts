#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import packageJson from "../package.json" with { type: "json" };
import { createDropToCdnClient, DropToCdnApiError } from "./client.js";
import { registerTools } from "./tools.js";

function fail(message: string): never {
  console.error(`Drop to CDN MCP server: ${message}`);
  process.exit(1);
}

let client;
try {
  client = createDropToCdnClient();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const skipValidation =
  process.env.DROPTOCDN_SKIP_VALIDATION === "1" ||
  process.env.DROPTOCDN_SKIP_VALIDATION === "true";

if (skipValidation) {
  console.error("Drop to CDN MCP server: skipping API key validation (DROPTOCDN_SKIP_VALIDATION)");
} else {
  try {
    await client.validateApiKey();
    console.error("Drop to CDN MCP server: API key validated");
  } catch (error) {
    const message =
      error instanceof DropToCdnApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    fail(message);
  }
}

serveStdio(() => {
  const server = new McpServer({ name: "droptocdn", version: packageJson.version });
  registerTools(server, client);
  return server;
});
