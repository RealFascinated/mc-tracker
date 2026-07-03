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
    credentials: "omit",
    signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const error = (await response.json()) as { error?: string };
      if (error.error) {
        message = error.error;
      }
    } catch {
      // Response may have no JSON body.
    }
    throw new ChatStreamError(message, response.status);
  }

  const stream = response.body;
  if (!stream) {
    throw new ChatStreamError("Empty response body", response.status);
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let chunk = await reader.read();
  while (!chunk.done) {
    buffer += decoder.decode(chunk.value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
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
    chunk = await reader.read();
  }
}
