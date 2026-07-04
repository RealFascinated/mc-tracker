import { apiUrl } from "@/lib/api/url";

export type ChatContextServer = {
  serverId: string;
  serverName: string;
};

export type ChatRequest = {
  message: string;
  sessionId?: string;
  rawHistory?: unknown[];
  contextServer?: ChatContextServer;
};

export type ChatToolCallRecord = {
  name: string;
};

export type ChatTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  contextMax: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
};

export type ChatStreamEvent =
  | { type: "toolStart"; name: string }
  | { type: "toolDone"; name: string }
  | { type: "delta"; content: string }
  | {
      type: "done";
      toolCalls?: ChatToolCallRecord[];
      usage?: ChatTokenUsage;
      rawHistory?: unknown[];
    }
  | { type: "error"; message: string };

export class ChatStreamError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatStreamError";
    this.status = status;
  }
}

async function errorMessageFromResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
    if (dataLine) {
      try {
        const payload = JSON.parse(
          dataLine.slice("data: ".length),
        ) as ChatStreamEvent;
        if (payload.type === "error" && payload.message) {
          return payload.message;
        }
      } catch {
        // Fall through to status text.
      }
    }
  }

  if (contentType.includes("application/json")) {
    try {
      const error = (await response.json()) as { error?: string };
      if (error.error) {
        return error.error;
      }
    } catch {
      // Response may have no JSON body.
    }
  }

  if (response.status === 401) {
    return "Log in to use chat";
  }

  return response.statusText || "Chat request failed";
}

export async function streamChat(
  body: ChatRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(apiUrl("/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      message: body.message,
      sessionId: body.sessionId,
      rawHistory: body.rawHistory,
      contextServer: body.contextServer,
    }),
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const message = await errorMessageFromResponse(response);
    throw new ChatStreamError(message, response.status);
  }

  const stream = response.body;
  if (!stream) {
    throw new ChatStreamError("Empty response body", response.status);
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  await readSseStream(reader, decoder, "", onEvent);
}

function dispatchSseFrames(
  buffer: string,
  onEvent: (event: ChatStreamEvent) => void,
) {
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() ?? "";
  for (const frame of frames) {
    const dataLine = frame
      .split("\n")
      .find((line) => line.startsWith("data: "));
    if (!dataLine) {
      continue;
    }
    const payload = dataLine.slice("data: ".length);
    if (!payload) {
      continue;
    }
    onEvent(JSON.parse(payload) as ChatStreamEvent);
  }
  return remainder;
}

async function readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  buffer: string,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const { done, value } = await reader.read();
  if (done) {
    return;
  }

  const nextBuffer = buffer + decoder.decode(value, { stream: true });
  await readSseStream(
    reader,
    decoder,
    dispatchSseFrames(nextBuffer, onEvent),
    onEvent,
  );
}
