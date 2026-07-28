import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  type DropToCdnClient,
  type FileListResponse,
  type FileResponse,
  formatToolError,
  formatToolResult,
} from "./client.js";

const fileResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  expires_at: z.string().nullable(),
  size: z.number(),
  mime_type: z.string(),
  original_name: z.string(),
});

const fileListResponseSchema = z.object({
  data: z.array(fileResponseSchema),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
  page: z.number().optional(),
  limit: z.number().optional(),
  total: z.number().optional(),
});

const uploadInputSchema = z
  .object({
    file_path: z
      .string()
      .optional()
      .describe("Absolute or relative path to a local file on this machine"),
    content_base64: z
      .string()
      .optional()
      .describe("Base64-encoded file bytes (for generated content instead of a local path)"),
    filename: z
      .string()
      .optional()
      .describe('Filename when using content_base64 (defaults to "upload")'),
    retention_days: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Paid plans only. How long to keep the file in days."),
    never_expire: z
      .boolean()
      .optional()
      .describe("Paid plans only. Set true to skip expiration."),
  })
  .refine(
    (data) => Boolean(data.file_path?.trim()) || Boolean(data.content_base64?.trim()),
    { message: "Provide file_path or content_base64" },
  )
  .refine((data) => !(data.file_path?.trim() && data.content_base64?.trim()), {
    message: "Provide only one of file_path or content_base64",
  });

export function registerTools(server: McpServer, client: DropToCdnClient): void {
  server.registerTool(
    "upload_file",
    {
      title: "Upload file to CDN",
      description:
        "Upload a local file or base64 content to Drop to CDN and return a public CDN URL. " +
        "Use file_path when the user references a file on disk; use content_base64 for generated content.",
      inputSchema: uploadInputSchema,
      outputSchema: fileResponseSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => {
      try {
        const result = await client.uploadFile({
          filePath: input.file_path,
          contentBase64: input.content_base64,
          filename: input.filename,
          retentionDays: input.retention_days,
          neverExpire: input.never_expire,
        });
        return formatToolResult(result satisfies FileResponse);
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  server.registerTool(
    "get_file",
    {
      title: "Get file metadata",
      description:
        "Get CDN URL, expiry, size, and metadata for a Drop to CDN file by ID.",
      inputSchema: z.object({
        file_id: z.string().describe("Drop to CDN file ID from upload_file or your dashboard"),
      }),
      outputSchema: fileResponseSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ file_id }) => {
      try {
        const result = await client.getFile(file_id);
        return formatToolResult(result satisfies FileResponse);
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  server.registerTool(
    "list_files",
    {
      title: "List uploaded files",
      description:
        "List files in the authenticated Drop to CDN account, newest first. Paginate with next_cursor.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Maximum files to return (default 20, max 100)"),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous list_files response"),
      }),
      outputSchema: fileListResponseSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ limit, cursor }) => {
      try {
        const result = await client.listFiles({ limit, cursor });
        return formatToolResult(result satisfies FileListResponse);
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  server.registerTool(
    "delete_file",
    {
      title: "Delete file",
      description: "Permanently delete a file from Drop to CDN by ID.",
      inputSchema: z.object({
        file_id: z.string().describe("Drop to CDN file ID to delete"),
      }),
      outputSchema: z.object({
        id: z.string(),
        deleted: z.literal(true),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ file_id }) => {
      try {
        const result = await client.deleteFile(file_id);
        return formatToolResult(result);
      } catch (error) {
        return formatToolError(error);
      }
    },
  );
}
