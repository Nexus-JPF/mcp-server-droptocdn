import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_BASE_URL = "https://api.droptocdn.com/v1";
/** Matches authenticated API upload limit (100 MB). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export type FileResponse = {
  id: string;
  url: string;
  expires_at: string | null;
  size: number;
  mime_type: string;
  original_name: string;
};

export type FileListResponse = {
  data: FileResponse[];
  has_more: boolean;
  next_cursor: string | null;
  page?: number;
  limit?: number;
  total?: number;
};

export class DropToCdnApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DropToCdnApiError";
  }
}

export type DropToCdnClient = {
  validateApiKey(): Promise<void>;
  uploadFile(input: UploadFileInput): Promise<FileResponse>;
  getFile(fileId: string): Promise<FileResponse>;
  listFiles(input?: ListFilesInput): Promise<FileListResponse>;
  deleteFile(fileId: string): Promise<{ id: string; deleted: true }>;
};

export type UploadFileInput = {
  filePath?: string;
  contentBase64?: string;
  filename?: string;
  retentionDays?: number;
  neverExpire?: boolean;
};

export type ListFilesInput = {
  limit?: number;
  cursor?: string;
};

type MultipartPart = {
  name: string;
  value: string | Buffer;
  filename?: string;
  contentType?: string;
};

function buildMultipartBody(parts: MultipartPart[]): { body: Buffer; contentType: string } {
  const boundary = `----droptocdnMcp${Date.now()}${Math.random().toString(36).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const part of parts) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) {
      const safeName = part.filename.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      header += `; filename="${safeName}"`;
    }
    header += "\r\n";
    if (part.contentType) {
      header += `Content-Type: ${part.contentType}\r\n`;
    }
    header += "\r\n";
    chunks.push(Buffer.from(header, "utf8"));
    chunks.push(typeof part.value === "string" ? Buffer.from(part.value, "utf8") : part.value);
    chunks.push(Buffer.from("\r\n", "utf8"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".htm": "text/html",
    ".json": "application/json",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".zip": "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

function assertUploadSize(bytes: number): void {
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new DropToCdnApiError(
      `File exceeds maximum upload size (${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)`,
    );
  }
}

function decodeBase64Content(raw: string): Buffer {
  const base64 = raw.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new DropToCdnApiError("Invalid base64 content");
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new DropToCdnApiError("content_base64 decoded to empty file");
  }

  assertUploadSize(buffer.length);
  return buffer;
}

async function readUploadPayload(input: UploadFileInput): Promise<{
  buffer: Buffer;
  filename: string;
  contentType: string;
}> {
  if (input.filePath?.trim()) {
    const resolved = path.resolve(input.filePath.trim());
    let fileStat;
    try {
      fileStat = await stat(resolved);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new DropToCdnApiError(`File not found: ${resolved}`);
      }
      throw error;
    }

    if (!fileStat.isFile()) {
      throw new DropToCdnApiError(`Not a file: ${resolved}`);
    }

    assertUploadSize(fileStat.size);

    let buffer: Buffer;
    try {
      buffer = await readFile(resolved);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new DropToCdnApiError(`File not found: ${resolved}`);
      }
      throw error;
    }

    const filename = path.basename(resolved);
    return {
      buffer,
      filename,
      contentType: guessMimeType(filename),
    };
  }

  if (input.contentBase64?.trim()) {
    const buffer = decodeBase64Content(input.contentBase64.trim());
    const filename = input.filename?.trim() || "upload";
    return {
      buffer,
      filename,
      contentType: guessMimeType(filename),
    };
  }

  throw new DropToCdnApiError("Provide either file_path or content_base64");
}

export function createDropToCdnClient(config?: {
  apiKey?: string;
  baseUrl?: string;
}): DropToCdnClient {
  const apiKey = config?.apiKey ?? process.env.DROPTOCDN_API_KEY?.trim();
  const baseUrl = (config?.baseUrl ?? process.env.DROPTOCDN_API_URL ?? DEFAULT_BASE_URL).replace(
    /\/$/,
    "",
  );

  if (!apiKey) {
    throw new DropToCdnApiError(
      "Missing DROPTOCDN_API_KEY. Create one at https://droptocdn.com/dashboard/settings",
    );
  }

  async function request<T>(
    method: string,
    pathname: string,
    init?: { body?: Buffer; headers?: Record<string, string> },
  ): Promise<T> {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...init?.headers,
      },
      body: init?.body,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof (payload as { error: unknown }).error === "string"
          ? (payload as { error: string }).error
          : `Request failed (${response.status})`;
      throw new DropToCdnApiError(message, response.status);
    }

    return payload as T;
  }

  return {
    async validateApiKey() {
      await request("GET", "/profile");
    },

    async uploadFile(input) {
      const { buffer, filename, contentType } = await readUploadPayload(input);
      const parts: MultipartPart[] = [
        {
          name: "file",
          value: buffer,
          filename,
          contentType,
        },
      ];

      if (input.retentionDays !== undefined) {
        parts.push({ name: "retention_days", value: String(input.retentionDays) });
      }
      if (input.neverExpire) {
        parts.push({ name: "never_expire", value: "true" });
      }

      const { body, contentType: multipartType } = buildMultipartBody(parts);

      return request<FileResponse>("POST", "/files", {
        body,
        headers: {
          "Content-Type": multipartType,
          "Content-Length": String(body.length),
        },
      });
    },

    async getFile(fileId) {
      const id = fileId.trim();
      if (!id) {
        throw new DropToCdnApiError("file_id is required");
      }
      return request<FileResponse>("GET", `/files/${encodeURIComponent(id)}`);
    },

    async listFiles(input = {}) {
      const params = new URLSearchParams();
      if (input.limit !== undefined) {
        params.set("limit", String(input.limit));
      }
      if (input.cursor?.trim()) {
        params.set("cursor", input.cursor.trim());
      }
      const query = params.toString();
      return request<FileListResponse>("GET", `/files${query ? `?${query}` : ""}`);
    },

    async deleteFile(fileId) {
      const id = fileId.trim();
      if (!id) {
        throw new DropToCdnApiError("file_id is required");
      }
      try {
        await request("DELETE", `/files/${encodeURIComponent(id)}`);
      } catch (error) {
        if (error instanceof DropToCdnApiError && error.status === 404) {
          return { id, deleted: true as const };
        }
        throw error;
      }
      return { id, deleted: true as const };
    },
  };
}

export function formatToolResult(data: unknown): {
  content: [{ type: "text"; text: string }];
  structuredContent: unknown;
} {
  const structuredContent = data;
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export function formatToolError(error: unknown): {
  content: [{ type: "text"; text: string }];
  isError: true;
} {
  const message =
    error instanceof DropToCdnApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unknown error";
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
